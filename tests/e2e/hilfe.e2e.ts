import { expect, test, type Page } from '@playwright/test';

// Help: chapters, search and context links.
const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('help chapters can be read and searched', async ({ page }) => {
	await login(page);
	await page.goto('/mehr');
	await page.getByRole('link', { name: 'Hilfe' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Hilfe' })).toBeVisible();
	await page.getByRole('link', { name: 'Erste Schritte' }).click();
	await expect(page.getByRole('heading', { name: 'Mindestbestand verstehen' })).toBeVisible();
	await page.getByRole('link', { name: /Weiter: Buchungen und Import/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Buchungen und Import' })).toBeVisible();

	await page.goto('/hilfe');
	await page.getByLabel('Hilfe durchsuchen').fill('Startsaldo Datum');
	const hit = page.getByRole('region', { name: 'Treffer' }).getByRole('link').first();
	await expect(hit).toContainText('Konten anlegen');
	await hit.click();
	await expect(page).toHaveURL(/\/hilfe\/erste-schritte#konten-anlegen$/);
});

test('pages link to the matching help section', async ({ page }) => {
	await login(page);
	await page.goto('/widgets');
	await page.getByRole('link', { name: 'Hilfe zu Widgets' }).click();
	await expect(page).toHaveURL(/\/hilfe\/widgets-und-mehr#widgets-auf-dem-iphone$/);
	await expect(page.getByRole('heading', { name: 'Widgets auf dem iPhone' })).toBeVisible();
});
