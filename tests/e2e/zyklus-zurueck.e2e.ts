import { expect, test, type Page } from '@playwright/test';

// The back button returns to where the user came from. Uses the card of zyklus-kreditkarte.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const CARD = 'Musterkarte';
const PAYEE = 'Buchhandlung Karte';

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

const back = (page: Page) => page.locator('main header').getByRole('link');

test('back leads to the page visited before', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(CARD) }).click();
	await expect(page.getByRole('heading', { level: 1, name: CARD })).toBeVisible();
	await expect(back(page)).toHaveText('Konten');
	const accountUrl = page.url();

	// Account → its bookings: the list offers the way back to the account.
	await page
		.getByRole('main')
		.getByRole('link', { name: /^Buchungen/ })
		.click();
	await expect(page).toHaveURL(/\/buchungen\?konto=/);
	await expect(back(page)).toHaveText(CARD);
	// Narrowing the list is no step of its own: the way back still leads to the account.
	await page.getByRole('searchbox', { name: 'Suchen' }).fill('Buchhandlung');
	await page.getByRole('searchbox', { name: 'Suchen' }).press('Enter');
	await expect(page).toHaveURL(/q=Buchhandlung/);
	await expect(back(page)).toHaveText(CARD);
	const listUrl = page.url();

	// Booking → back: the filtered list again, not all bookings.
	await page.getByRole('link', { name: new RegExp(PAYEE) }).click();
	await expect(page.getByRole('heading', { level: 1, name: PAYEE })).toBeVisible();
	await expect(back(page)).toHaveText('Buchungen');
	await back(page).click();
	await expect(page).toHaveURL(listUrl);
	await expect(page.getByRole('heading', { level: 1, name: 'Buchungen' })).toBeVisible();

	await back(page).click();
	await expect(page).toHaveURL(accountUrl);
	await expect(back(page)).toHaveText('Konten');

	// Still right after a reload.
	await page
		.getByRole('main')
		.getByRole('link', { name: /^Buchungen/ })
		.click();
	await page.getByRole('link', { name: new RegExp(PAYEE) }).click();
	await expect(back(page)).toHaveText('Buchungen');
	await page.reload();
	await expect(back(page)).toHaveText('Buchungen');
	await back(page).click();
	await expect(page).toHaveURL(/\/buchungen\?konto=[^&]+$/);
	await expect(back(page)).toHaveText(CARD);
});

test('opened directly, back leads to the parent page', async ({ page, context }) => {
	await login(page);
	await page.goto('/buchungen');
	await expect(back(page)).toHaveCount(0);
	await page.getByRole('link', { name: new RegExp(PAYEE) }).click();
	await expect(page.getByRole('heading', { level: 1, name: PAYEE })).toBeVisible();
	const bookingUrl = page.url();

	// A new tab has no way back yet.
	const tab = await context.newPage();
	await tab.goto(bookingUrl);
	await expect(back(tab)).toHaveText('Buchungen');
	await back(tab).click();
	await expect(tab).toHaveURL(/\/buchungen$/);
	await tab.close();
});
