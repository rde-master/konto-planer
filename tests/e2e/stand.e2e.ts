import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Runs after schnellerfassung (giro "Alltagskonto" with bookings; lena may only view it).
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const LENA = { username: 'lena', password: 'lena-richtig-1' };
const ACCOUNT = 'Alltagskonto';

async function login(page: Page, user: { username: string; password: string }) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(user.username);
	await page.getByLabel('Passwort').fill(user.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openAccount(page: Page) {
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await expect(page.getByRole('heading', { level: 1, name: ACCOUNT })).toBeVisible();
}

test('correcting the balance books the difference as adjustment', async ({ page }) => {
	await login(page, ADMIN);
	await openAccount(page);
	await page.getByRole('button', { name: 'Kontostand korrigieren' }).click();
	const sheet = page.getByRole('dialog', { name: 'Kontostand korrigieren' });
	await sheet.getByLabel('Tatsächlicher Stand in €').fill('1.000');
	await sheet.getByLabel('Stand am').fill(addDays(todayBerlin(), 1));
	await sheet.getByRole('button', { name: 'Korrigieren' }).click();
	await expect(sheet.getByText('Das Datum darf nicht in der Zukunft liegen.')).toBeVisible();

	await sheet.getByLabel('Stand am').fill(todayBerlin());
	await sheet.getByRole('button', { name: 'Korrigieren' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toContainText('Kontostand korrigiert.');
	await expect(page.getByLabel('Kontostand', { exact: true })).toHaveText(/1\.000,00\s€/);

	// The same balance again: nothing to book.
	await page.getByRole('button', { name: 'Kontostand korrigieren' }).click();
	await sheet.getByLabel('Tatsächlicher Stand in €').fill('1000,00');
	await sheet.getByRole('button', { name: 'Korrigieren' }).click();
	await expect(sheet.getByText('Der Kontostand stimmt bereits.')).toBeVisible();
});

test('bookings change the balance; the quick entry tells the new one', async ({ page }) => {
	await login(page, ADMIN);
	await page.getByRole('button', { name: 'Schnellerfassung' }).click();
	const sheet = page.getByRole('dialog', { name: 'Schnellerfassung' });
	await sheet.getByLabel('Betrag in €').fill('10');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(page.getByRole('status')).toHaveText(/Neuer Stand: 990,00\s€\./);

	await page.goto('/konten');
	await expect(page.getByRole('link', { name: new RegExp(ACCOUNT) })).toContainText(/990,00\s€/);
});

test('viewers see the balance but cannot correct it', async ({ page }) => {
	await login(page, LENA);
	await openAccount(page);
	await expect(page.getByLabel('Kontostand', { exact: true })).toHaveText(/990,00\s€/);
	await expect(page.getByRole('button', { name: 'Kontostand korrigieren' })).toHaveCount(0);
});

test('adjustments can be deleted, not changed; logged', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/buchungen');
	await page
		.getByRole('region', { name: 'Heute' })
		.getByRole('link', { name: /Anpassung des Kontostands/ })
		.click();
	await expect(page.getByText('Ändern lassen sie sich nicht, nur löschen.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Sichern', exact: true })).toHaveCount(0);
	await openTab(page, 'Aktionen');
	await page.getByRole('button', { name: 'Anpassung löschen' }).click();
	await page
		.getByRole('dialog', { name: 'Anpassung löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page).toHaveURL('/buchungen');
	await expect(page.getByRole('link', { name: /Anpassung des Kontostands/ })).toHaveCount(0);

	await page.goto('/einstellungen/protokoll?bereich=booking');
	await page.getByRole('button').filter({ hasText: 'Kontostand korrigiert' }).first().click();
	const entry = page.getByRole('dialog', { name: 'Eintrag' });
	await expect(entry).toContainText('Stand nachher');
	await expect(entry).toContainText(/1\.000,00\s€/);
});
