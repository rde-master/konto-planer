import { expect, test, type Page } from '@playwright/test';

// Runs after foundation.e2e.ts, which created the admin "erika".
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const MAX = { name: 'Max Beispiel', username: 'max', password: 'max-start-pw-1' };
const MAX_RESET = 'max-reset-pw-2';
const MAX_OWN = 'max-eigenes-pw-3';

async function login(page: Page, username: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(username);
	await page.getByLabel('Passwort').fill(password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openUser(page: Page, name: string) {
	await page.goto('/einstellungen/benutzer');
	await page.getByRole('link', { name: new RegExp(name) }).click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test('admin creates a user via the sheet', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/einstellungen');
	await page.getByRole('link', { name: 'Benutzer' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Benutzer' })).toBeVisible();
	await expect(page.getByRole('link', { name: /Erika Muster \(du\)/ })).toBeVisible();

	await page.getByRole('button', { name: 'Benutzer anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Benutzer' });
	await expect(sheet).toBeVisible();
	await sheet.getByLabel('Name', { exact: true }).fill(MAX.name);
	await sheet.getByLabel('Benutzername').fill(MAX.username);
	await sheet.getByLabel('Passwort', { exact: true }).fill(MAX.password);
	await sheet.getByLabel('Passwort wiederholen').fill(MAX.password);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();

	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Max Beispiel wurde angelegt.');
	await expect(page.getByRole('link', { name: /Max Beispiel.*max · Benutzer/ })).toBeVisible();
});

test('duplicate usernames are rejected', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/einstellungen/benutzer');
	await page.getByRole('button', { name: 'Benutzer anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Benutzer' });
	await sheet.getByLabel('Name', { exact: true }).fill('Doppelt');
	await sheet.getByLabel('Benutzername').fill('MAX');
	await sheet.getByLabel('Passwort', { exact: true }).fill(MAX.password);
	await sheet.getByLabel('Passwort wiederholen').fill(MAX.password);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet.getByText('Dieser Benutzername ist schon vergeben.')).toBeVisible();
});

test('normal users have no access to user management', async ({ page }) => {
	await login(page, MAX.username, MAX.password);
	await page.goto('/einstellungen');
	await expect(page.getByRole('heading', { name: 'Verwaltung' })).toHaveCount(0);
	const response = await page.goto('/einstellungen/benutzer');
	expect(response?.status()).toBe(403);
});

test('admin resets a password and the user is signed out everywhere', async ({ page, browser }) => {
	const maxContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
	const maxPage = await maxContext.newPage();
	await login(maxPage, MAX.username, MAX.password);

	await login(page, ADMIN.username, ADMIN.password);
	await openUser(page, MAX.name);
	await page.getByRole('button', { name: 'Passwort zurücksetzen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Passwort zurücksetzen' });
	await sheet.getByLabel('Neues Passwort', { exact: true }).fill(MAX_RESET);
	await sheet.getByLabel('Neues Passwort wiederholen').fill(MAX_RESET);
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toContainText('Passwort zurückgesetzt');

	await maxPage.reload();
	await expect(maxPage).toHaveURL(/\/login/);
	await maxPage.getByLabel('Benutzername').fill(MAX.username);
	await maxPage.getByLabel('Passwort').fill(MAX.password);
	await maxPage.getByRole('button', { name: 'Anmelden' }).click();
	await expect(maxPage.getByRole('alert')).toBeVisible();
	await login(maxPage, MAX.username, MAX_RESET);
	await maxContext.close();
});

test('users change their own password', async ({ page }) => {
	await login(page, MAX.username, MAX_RESET);
	await page.goto('/einstellungen');
	await page.getByRole('button', { name: 'Passwort ändern' }).click();
	const sheet = page.getByRole('dialog', { name: 'Passwort ändern' });

	await sheet.getByLabel('Aktuelles Passwort').fill('falsch-falsch');
	await sheet.getByLabel('Neues Passwort', { exact: true }).fill(MAX_OWN);
	await sheet.getByLabel('Neues Passwort wiederholen').fill(MAX_OWN);
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet.getByText('Das aktuelle Passwort ist falsch.')).toBeVisible();

	await sheet.getByLabel('Aktuelles Passwort').fill(MAX_RESET);
	await sheet.getByLabel('Neues Passwort', { exact: true }).fill(MAX_OWN);
	await sheet.getByLabel('Neues Passwort wiederholen').fill(MAX_OWN);
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByText('Passwort geändert. Andere Geräte wurden abgemeldet.')).toBeVisible();

	// The current device stays signed in.
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
});

test('the last admin cannot demote themselves', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await openUser(page, 'Erika Muster');
	await expect(page.getByRole('button', { name: 'Benutzer löschen' })).toHaveCount(0);
	await page.getByText('Benutzer', { exact: true }).last().click();
	await page.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('alert')).toHaveText('Es muss mindestens einen Admin geben.');
});

test('admin edits and deletes a user', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await openUser(page, MAX.name);
	await page.getByLabel('Name', { exact: true }).fill('Max Geändert');
	await page.getByLabel('E-Mail (optional)').fill('max@example.org');
	await page.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');
	await expect(page.getByRole('heading', { level: 1, name: 'Max Geändert' })).toBeVisible();

	await page.getByRole('button', { name: 'Benutzer löschen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Benutzer löschen' });
	await sheet.getByRole('button', { name: 'Löschen' }).click();
	await expect(page).toHaveURL('/einstellungen/benutzer');
	await expect(page.getByRole('link', { name: /Max Geändert/ })).toHaveCount(0);
});
