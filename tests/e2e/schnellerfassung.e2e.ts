import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Runs after recurring (giro account "Alltagskonto"; lena may only view it, nina has no access).
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const LENA = { username: 'lena', password: 'lena-richtig-1' };
const NINA = { username: 'nina', password: 'nina-passwort-1' };
const ACCOUNT = 'Alltagskonto';

let bookingUrl = '';

async function login(page: Page, user: { username: string; password: string }) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(user.username);
	await page.getByLabel('Passwort').fill(user.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

function quickSheet(page: Page) {
	return page.getByRole('dialog', { name: 'Schnellerfassung' });
}

test('quick entry from any page books for today', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Schnellerfassung' }).click();
	const sheet = quickSheet(page);
	await sheet.getByLabel('Betrag in €').fill('0');
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet.getByText('Bitte einen Betrag größer 0 eingeben')).toBeVisible();

	await sheet.getByLabel('Betrag in €').fill('12,50');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText(/−12,50\s€ auf Alltagskonto gebucht\./);
	// The page stays where it was.
	await expect(page.getByRole('heading', { level: 1, name: 'Dauerposten' })).toBeVisible();

	// The account is remembered; income is one tap away.
	await page.getByRole('button', { name: 'Schnellerfassung' }).click();
	const chosen = await sheet
		.getByLabel('Konto')
		.locator('option', { hasText: ACCOUNT })
		.getAttribute('value');
	await expect(sheet.getByLabel('Konto')).toHaveValue(chosen ?? 'missing');
	await sheet.getByText('Einnahme', { exact: true }).click();
	await sheet.getByLabel('Betrag in €').fill('20');
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	await page.goto('/buchungen');
	const todayGroup = page.getByRole('region', { name: 'Heute' });
	await expect(todayGroup.getByRole('link')).toHaveCount(2);
	await expect(todayGroup).toContainText(/−12,50\s€/);
	await expect(todayGroup).toContainText(/\+20,00\s€/);
});

test('the full form takes date, payee and note', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('3,80');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Datum').fill(addDays(todayBerlin(), 1));
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill('Bäckerei Muster');
	await sheet.getByLabel('Notiz (optional)').fill('Brötchen');
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet.getByText('Das Datum darf nicht in der Zukunft liegen.')).toBeVisible();

	await sheet.getByLabel('Datum').fill(addDays(todayBerlin(), -1));
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
	const yesterday = page.getByRole('region', { name: 'Gestern' });
	const row = yesterday.getByRole('link', { name: /Bäckerei Muster/ });
	await expect(row).toContainText(/−3,80\s€/);

	await row.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Bäckerei Muster' })).toBeVisible();
	bookingUrl = new URL(page.url()).pathname;
	await page.locator('main').getByLabel('Betrag in €', { exact: true }).fill('4,20');
	await page.getByRole('button', { name: 'Sichern', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');
	await expect(page.locator('main')).toContainText(/−4,20\s€/);
});

test('viewers see bookings read-only; others get 404', async ({ page }) => {
	await login(page, LENA);
	await page.goto(bookingUrl);
	await expect(page.getByText('Du kannst diese Buchung nur ansehen.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Sichern', exact: true })).toHaveCount(0);

	await login(page, NINA);
	const res = await page.goto(bookingUrl);
	expect(res?.status()).toBe(404);
});

test('deleting a booking; the account page links to its bookings; protocol', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto(bookingUrl);
	await page.getByRole('button', { name: 'Buchung löschen' }).click();
	await page
		.getByRole('dialog', { name: 'Buchung löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page).toHaveURL('/buchungen');
	await expect(page.getByRole('link', { name: /Bäckerei Muster/ })).toHaveCount(0);

	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	const link = page.locator('main').getByRole('link', { name: /Buchungen/ });
	await expect(link).toContainText('2');
	await link.click();
	await expect(page).toHaveURL(/\/buchungen\?konto=/);
	await expect(page.locator('main').getByLabel('Konto').first()).toHaveValue(/[0-9a-f-]{36}/);
	// Accounts with bookings can only be archived.
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await expect(page.getByRole('button', { name: 'Konto löschen' })).toHaveCount(0);

	await page.goto('/einstellungen/protokoll?bereich=booking');
	await expect(
		page.getByRole('button').filter({ hasText: 'Buchung angelegt' }).first()
	).toBeVisible();
	await expect(page.getByRole('button').filter({ hasText: 'Buchung geändert' })).toBeVisible();
	await expect(page.getByRole('button').filter({ hasText: 'Buchung gelöscht' })).toBeVisible();
});
