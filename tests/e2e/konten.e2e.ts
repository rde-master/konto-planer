import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';

// Runs after foundation.e2e.ts, which created the admin "erika".
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const KAI = { name: 'Kai Konto', username: 'kai', password: 'kai-passwort-1' };
const IBAN = 'DE89 3704 0044 0532 0130 00';

async function login(page: Page, username: string, password: string) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(username);
	await page.getByLabel('Passwort').fill(password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openCreateSheet(page: Page) {
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	return page.getByRole('dialog', { name: 'Neues Konto' });
}

function accountLink(page: Page, name: string) {
	return page.getByRole('link', { name: new RegExp(name) });
}

test('admin creates a giro account; invalid IBAN is rejected', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.getByRole('navigation').last().getByRole('link', { name: 'Konten' }).click();
	await expect(page.getByText('Noch keine Konten')).toBeVisible();

	const sheet = await openCreateSheet(page);
	await sheet.getByLabel('Name').fill('Gemeinschaftskonto');
	await sheet.getByLabel('IBAN (optional)').fill('DE89 3704 0044 0532 0130 01');
	await sheet.getByTitle('Grün').click();
	await expect(sheet.getByRole('radio', { name: 'Grün' })).toBeChecked();
	await sheet.getByLabel('Betrag in €').fill('1.234,56');
	await sheet.getByLabel('Stand am').fill('2026-11-01');
	await sheet.getByLabel('Dispo-Rahmen in € (optional)').fill('1.000');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet.getByText('Diese IBAN ist ungültig')).toBeVisible();
	// Other inputs survive the failed submit.
	await expect(sheet.getByLabel('Betrag in €')).toHaveValue('1.234,56');

	await sheet.getByLabel('IBAN (optional)').fill(IBAN);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Konto „Gemeinschaftskonto“ wurde angelegt.');
	const row = accountLink(page, 'Gemeinschaftskonto');
	await expect(row).toContainText('•• 3000');
	await expect(row).toContainText(/1\.234,56\s€/);
	await expect(page.getByRole('heading', { name: 'Girokonten' })).toBeVisible();
});

test('the same IBAN cannot be used twice', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	const sheet = await openCreateSheet(page);
	await sheet.getByLabel('Name').fill('Doppelt');
	await sheet.getByLabel('IBAN (optional)').fill(IBAN.toLowerCase());
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet.getByText('Diese IBAN gehört schon zu einem anderen Konto.')).toBeVisible();
});

test('savings accounts have no overdraft field', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	const sheet = await openCreateSheet(page);
	await expect(sheet.getByLabel('Dispo-Rahmen in € (optional)')).toBeVisible();
	await sheet.getByText('Sparbuch', { exact: true }).click();
	await expect(sheet.getByLabel('Dispo-Rahmen in € (optional)')).toHaveCount(0);
	await sheet.getByLabel('Name').fill('Urlaubskasse');
	await sheet.getByLabel('Betrag in €').fill('500');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('heading', { name: 'Sparbücher' })).toBeVisible();
	await expect(accountLink(page, 'Urlaubskasse')).toContainText(/500,00\s€/);
});

test('admin creates kai and grants view access to one account', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/einstellungen/benutzer');
	await page.getByRole('button', { name: 'Benutzer anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Benutzer' });
	await sheet.getByLabel('Name', { exact: true }).fill(KAI.name);
	await sheet.getByLabel('Benutzername').fill(KAI.username);
	await sheet.getByLabel('Passwort', { exact: true }).fill(KAI.password);
	await sheet.getByLabel('Passwort wiederholen').fill(KAI.password);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await page.goto('/konten');
	await accountLink(page, 'Gemeinschaftskonto').click();
	await openTab(page, 'Bearbeiten');
	await page.getByLabel(KAI.name).selectOption('view');
	await page.getByRole('button', { name: 'Zugriffe sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Zugriffe gesichert.');
	await expect(page.getByLabel(KAI.name)).toHaveValue('view');
});

test('kai sees only the shared account, read-only', async ({ page }) => {
	await login(page, KAI.username, KAI.password);
	await page.goto('/konten');
	await expect(page.getByRole('button', { name: 'Konto anlegen' })).toHaveCount(0);
	await expect(accountLink(page, 'Gemeinschaftskonto')).toContainText('Nur ansehen');
	await expect(accountLink(page, 'Urlaubskasse')).toHaveCount(0);

	await accountLink(page, 'Gemeinschaftskonto').click();
	await expect(page.getByText('Du kannst dieses Konto nur ansehen.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Sichern', exact: true })).toHaveCount(0);
	await expect(page.getByText('Zugriff', { exact: true })).toHaveCount(0);
	const sharedUrl = page.url();

	// Accounts without access look like they do not exist.
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/konten');
	await accountLink(page, 'Urlaubskasse').click();
	await expect(page.getByRole('heading', { level: 1, name: 'Urlaubskasse' })).toBeVisible();
	const hiddenUrl = page.url();
	expect(hiddenUrl).toMatch(/\/konten\/[0-9a-f-]{36}$/);
	await login(page, KAI.username, KAI.password);
	expect((await page.goto(hiddenUrl))?.status()).toBe(404);
	expect((await page.goto(sharedUrl))?.status()).toBe(200);

	// Edits are refused on the server, too.
	const res = await page.request.post(`${sharedUrl}?/update`, {
		form: { name: 'Gehackt', color: 'red', openingBalance: '0', openingDate: '2026-11-01' },
		headers: { origin: test.info().project.use.baseURL!, 'x-sveltekit-action': 'true' }
	});
	expect(await res.text()).toContain('Du darfst dieses Konto nicht bearbeiten.');
});

test('with edit access kai can change account data', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/konten');
	await accountLink(page, 'Gemeinschaftskonto').click();
	await openTab(page, 'Bearbeiten');
	await page.getByLabel(KAI.name).selectOption('edit');
	await page.getByRole('button', { name: 'Zugriffe sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Zugriffe gesichert.');

	await login(page, KAI.username, KAI.password);
	await page.goto('/konten');
	await accountLink(page, 'Gemeinschaftskonto').click();
	await openTab(page, 'Bearbeiten');
	await page.getByLabel('Name').fill('Haushaltskonto');
	await page.getByLabel('Dispo-Rahmen in € (optional)').fill('1.500,00');
	await page.getByRole('button', { name: 'Sichern', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');
	await expect(page.getByRole('heading', { level: 1, name: 'Haushaltskonto' })).toBeVisible();
	// No admin functions for kai.
	await openTab(page, 'Bearbeiten');
	await expect(page.getByText('Archivieren')).toHaveCount(0);
});

test('archive makes an account read-only, restore undoes it', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/konten');
	await accountLink(page, 'Urlaubskasse').click();
	await openTab(page, 'Bearbeiten');
	await page.getByRole('button', { name: 'Archivieren' }).click();
	await expect(page.getByRole('status')).toContainText('Konto archiviert');
	await openTab(page, 'Übersicht');
	await expect(page.getByText('Archivierte Konten sind schreibgeschützt.')).toBeVisible();

	await page.goto('/konten');
	await expect(page.getByRole('heading', { name: 'Archiviert' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Sparbücher' })).toHaveCount(0);

	await accountLink(page, 'Urlaubskasse').click();
	await openTab(page, 'Bearbeiten');
	await page.getByRole('button', { name: 'Wiederherstellen' }).click();
	await expect(page.getByRole('status')).toHaveText('Konto wiederhergestellt.');
	await expect(page.getByRole('button', { name: 'Sichern', exact: true })).toBeVisible();
});

test('changes appear in the protocol', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/einstellungen/protokoll?bereich=account');
	for (const title of [
		'Konto angelegt',
		'Zugriffe geändert',
		'Konto geändert',
		'Konto archiviert',
		'Konto wiederhergestellt'
	]) {
		await expect(page.getByRole('button').filter({ hasText: title }).first()).toBeVisible();
	}
	await page.getByRole('button').filter({ hasText: 'Konto geändert' }).click();
	const sheet = page.getByRole('dialog', { name: 'Eintrag' });
	await expect(sheet.getByText('Kai Konto')).toBeVisible();
	await expect(sheet.getByText(/1\.000,00\s€/)).toBeVisible();
	await expect(sheet.getByText(/1\.500,00\s€/)).toBeVisible();
});

test('admin deletes an account without data', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/konten');
	await accountLink(page, 'Urlaubskasse').click();
	await openTab(page, 'Bearbeiten');
	await page.getByRole('button', { name: 'Konto löschen' }).click();
	await page
		.getByRole('dialog', { name: 'Konto löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page).toHaveURL('/konten');
	await expect(accountLink(page, 'Urlaubskasse')).toHaveCount(0);
});
