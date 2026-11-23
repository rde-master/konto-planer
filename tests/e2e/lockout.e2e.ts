import { expect, test, type Page } from '@playwright/test';

// Runs after foundation.e2e.ts, which created the admin "erika".
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const LENA = { name: 'Lena Sperre', username: 'lena', password: 'lena-richtig-1' };

async function attempt(page: Page, username: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(username);
	await page.getByLabel('Passwort').fill(password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
}

async function loginAdmin(page: Page) {
	await attempt(page, ADMIN.username, ADMIN.password);
	await expect(page).toHaveURL('/');
}

test('setup: admin creates lena', async ({ page }) => {
	await loginAdmin(page);
	await page.goto('/einstellungen/benutzer');
	await page.getByRole('button', { name: 'Benutzer anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Benutzer' });
	await sheet.getByLabel('Name', { exact: true }).fill(LENA.name);
	await sheet.getByLabel('Benutzername').fill(LENA.username);
	await sheet.getByLabel('Passwort', { exact: true }).fill(LENA.password);
	await sheet.getByLabel('Passwort wiederholen').fill(LENA.password);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
});

test('five wrong passwords lock the login, even for the right password', async ({ page }) => {
	for (let i = 1; i <= 4; i++) {
		await attempt(page, LENA.username, `falsch-${i}-xxxx`);
		await expect(page.getByRole('alert')).toHaveText('Benutzername oder Passwort ist falsch.');
	}
	await attempt(page, LENA.username, 'falsch-5-xxxx');
	await expect(page.getByRole('alert')).toContainText('Zu viele Fehlversuche');

	await attempt(page, LENA.username, LENA.password);
	await expect(page.getByRole('alert')).toContainText(
		/Zu viele Fehlversuche\. Anmeldung wieder möglich ab \d\d:\d\d Uhr\./
	);
	await expect(page).toHaveURL(/\/login/);
});

test('unknown usernames are locked the same way', async ({ page }) => {
	for (let i = 1; i <= 5; i++) await attempt(page, 'gibtsnicht', `falsch-${i}-xxxx`);
	await expect(page.getByRole('alert')).toContainText('Zu viele Fehlversuche');
});

test('other users are not affected by the lock', async ({ page }) => {
	await loginAdmin(page);
});

test('admin sees the lock and lifts it', async ({ page }) => {
	await loginAdmin(page);
	await page.goto('/einstellungen/benutzer');
	await page.getByRole('link', { name: /Lena Sperre/ }).click();
	await expect(page.getByRole('heading', { name: 'Anmeldung gesperrt' })).toBeVisible();
	await page.getByRole('button', { name: 'Sperre aufheben' }).click();
	await expect(page.getByRole('status')).toHaveText('Sperre aufgehoben.');
	await expect(page.getByRole('heading', { name: 'Anmeldung gesperrt' })).toHaveCount(0);
});

test('after unlocking, the right password works again', async ({ page }) => {
	await attempt(page, LENA.username, LENA.password);
	await expect(page).toHaveURL('/');
});

test('a successful login resets the failure counter', async ({ page }) => {
	for (let i = 1; i <= 4; i++) await attempt(page, LENA.username, `falsch-${i}-xxxx`);
	await attempt(page, LENA.username, LENA.password);
	await expect(page).toHaveURL('/');
	await page.context().clearCookies();
	await attempt(page, LENA.username, 'noch-mal-falsch');
	await expect(page.getByRole('alert')).toHaveText('Benutzername oder Passwort ist falsch.');
});
