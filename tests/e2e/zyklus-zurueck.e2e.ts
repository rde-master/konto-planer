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

test('on the phone the list has one plus, and the back button stands above the small title', async ({
	page
}) => {
	await login(page);
	// The round plus at the bottom opens the list's own form; there is no second one at the top.
	await page.goto('/buchungen?q=PIXELSHOP');
	await expect(page.getByRole('button', { name: 'Buchung erfassen' })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Schnellerfassung' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await expect(sheet.getByLabel('Datum')).toBeVisible();
	await sheet.getByRole('button', { name: 'Abbrechen' }).click();
	await expect(sheet).toBeHidden();

	// A booking with a long name (from zyklus-regeln): elsewhere the plus is the quick entry.
	// With the amount: the filter chip names the shop as well.
	await page
		.getByRole('main')
		.getByRole('link', { name: /PIXELSHOP.*2,19/ })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: /PIXELSHOP/ })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Schnellerfassung' })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Buchung erfassen' })).toHaveCount(0);

	// Scrolled: the small title appears below the back button; neither is cut short.
	await page.mouse.wheel(0, 600);
	const small = page.locator('main header [data-compact-title]');
	await expect(small).toBeVisible();
	await expect(small).toContainText('PIXELSHOP');
	const back = page.locator('main header').getByRole('link');
	const label = back.locator('span');
	await expect(label).toHaveText('Buchungen');
	expect(await label.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
	const backBox = (await back.boundingBox())!;
	const smallBox = (await small.boundingBox())!;
	expect(backBox.y + backBox.height).toBeLessThanOrEqual(smallBox.y + 1);
	await back.click();
	await expect(page).toHaveURL(/\/buchungen\?q=PIXELSHOP/);
});
