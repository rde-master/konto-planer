import { expect, test, type Page } from '@playwright/test';
import { formatDay, todayBerlin } from '../../src/lib/dates';

// "Dauerposten daraus machen": a booking becomes the first payment of a new recurring item.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Wandelkonto';
const PAYEE = 'Zeitschrift Wandel';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('a booking becomes a recurring item without being booked twice', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('300');
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('9,90');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(PAYEE);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	await page.goto(`/buchungen?q=${encodeURIComponent(PAYEE)}`);
	await page
		.getByRole('main')
		.getByRole('link', { name: new RegExp(`${PAYEE}.*9,90`) })
		.click();
	await page.getByRole('button', { name: 'Dauerposten daraus machen' }).click();

	// The form is open and filled from the booking.
	const form = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await expect(form).toBeVisible();
	await expect(form.getByLabel('Bezeichnung')).toHaveValue(PAYEE);
	await expect(form.getByLabel('Betrag in €')).toHaveValue('9,90');
	await expect(form.getByLabel('Konto')).toHaveValue(/.+/);
	await expect(form.getByLabel('Erste Fälligkeit')).toHaveValue(today);
	await expect(form.getByText('Aus der Buchung übernommen.')).toBeVisible();
	await form.getByRole('button', { name: 'Anlegen' }).click();

	// Straight to the new item; the booking is its first, already booked payment.
	await expect(page.getByRole('heading', { level: 1, name: PAYEE })).toBeVisible();
	await expect(page).toHaveURL(/\/dauerposten\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('main')).toContainText(formatDay(today));

	// Still exactly one booking: no provisional copy for the same day.
	await page.goto(`/buchungen?q=${encodeURIComponent(PAYEE)}`);
	await expect(
		page.getByRole('main').getByRole('link', { name: new RegExp(`${PAYEE}.*9,90`) })
	).toHaveCount(1);

	// The booking now belongs to the item: the action is gone.
	await page
		.getByRole('main')
		.getByRole('link', { name: new RegExp(`${PAYEE}.*9,90`) })
		.click();
	await expect(page.getByRole('button', { name: 'Als Vorlage sichern' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Dauerposten daraus machen' })).toHaveCount(0);
});
