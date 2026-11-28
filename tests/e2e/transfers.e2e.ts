import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';

// Runs after kategorien (user "nina"), lockout
// (user "lena") and recurring (giro account "Alltagskonto").
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const LENA = { name: 'Lena Sperre', username: 'lena', password: 'lena-richtig-1' };
const NINA = { name: 'Nina Norm', username: 'nina', password: 'nina-passwort-1' };
const SOURCE = 'Haushaltskasse';
const TARGET = 'Erikas Sparbuch';

async function login(page: Page, username: string, password: string) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(username);
	await page.getByLabel('Passwort').fill(password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function createAccount(page: Page, name: string, savings: boolean) {
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	if (savings) await sheet.getByText('Sparbuch', { exact: true }).click();
	await sheet.getByLabel('Name').fill(name);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

async function setAccess(page: Page, account: string, user: string, level: 'view' | 'edit') {
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(account) }).click();
	await page.getByLabel(user).selectOption(level);
	await page.getByRole('button', { name: 'Zugriffe sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Zugriffe gesichert.');
}

async function openCreateSheet(page: Page) {
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	return page.getByRole('dialog', { name: 'Neuer Dauerposten' });
}

function group(page: Page, account: string) {
	return page.getByRole('region', { name: account, exact: true });
}

test('setup: lena edits the source, nina only sees the target', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await createAccount(page, SOURCE, false);
	await setAccess(page, SOURCE, LENA.name, 'edit');
	await createAccount(page, TARGET, true);
	await setAccess(page, TARGET, NINA.name, 'view');
});

test('lena transfers to an account she cannot see', async ({ page }) => {
	await login(page, LENA.username, LENA.password);
	const sheet = await openCreateSheet(page);
	await sheet.getByText('Umbuchung', { exact: true }).click();
	// Transfers have no category or payee, only standing order or manual payment.
	await expect(sheet.getByLabel('Kategorie')).toHaveCount(0);
	await expect(sheet.getByLabel('Empfänger (optional)')).toHaveCount(0);
	await expect(sheet.getByLabel('Zahlart').locator('option')).toHaveText([
		'Keine Angabe',
		'Dauerauftrag',
		'Manuelle Überweisung'
	]);

	await sheet.getByLabel('Bezeichnung', { exact: true }).fill('Sparrate');
	await sheet.getByLabel('Betrag in €').fill('100');
	await sheet.getByLabel('Von Konto').selectOption({ label: SOURCE });
	// The source is not offered as target; foreign accounts are, by name.
	const target = sheet.getByLabel('Auf Konto');
	await expect(target.locator('option', { hasText: SOURCE })).toHaveCount(0);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet.getByText('Bitte ein Zielkonto wählen.')).toBeVisible();

	await target.selectOption({ label: TARGET });
	await sheet.getByLabel('Zahlart').selectOption({ label: 'Dauerauftrag' });
	await sheet.getByLabel('Erste Fälligkeit').fill('2030-01-01');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Dauerposten „Sparrate“ wurde angelegt.');

	const row = group(page, SOURCE).getByRole('link', { name: /Sparrate/ });
	await expect(row).toContainText(`monatlich · auf ${TARGET}`);
	await expect(row).toContainText(/−100,00\s€/);
	await expect(group(page, SOURCE)).toContainText(/Pro Monat: Ausgaben 100,00\s€/);
	// Lena cannot see the target account itself.
	await expect(group(page, TARGET)).toHaveCount(0);
});

test('nina sees the transfer as incoming on her account, read-only', async ({ page }) => {
	await login(page, NINA.username, NINA.password);
	await page.goto('/dauerposten');
	await expect(group(page, SOURCE)).toHaveCount(0);
	const row = group(page, TARGET).getByRole('link', { name: /Sparrate/ });
	await expect(row).toContainText(`von ${SOURCE}`);
	await expect(row).toContainText(/\+100,00\s€/);
	await expect(group(page, TARGET)).toContainText(/Einnahmen 100,00\s€/);

	await row.click();
	await expect(page.getByText(`${SOURCE} → ${TARGET}`)).toBeVisible();
	await expect(page.getByText('Du kannst diesen Dauerposten nur ansehen.')).toBeVisible();
	await expect(page.getByRole('tab', { name: 'Bearbeiten' })).toHaveCount(0);
	// The source account stays hidden.
	await page.goto('/konten');
	await expect(page.getByRole('link', { name: new RegExp(SOURCE) })).toHaveCount(0);
});

test('admin sees both sides; savings accounts can only transfer', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/dauerposten');
	await expect(group(page, SOURCE)).toContainText(/−100,00\s€/);
	await expect(group(page, TARGET)).toContainText(/\+100,00\s€/);

	const sheet = await openCreateSheet(page);
	await expect(sheet.getByLabel('Konto').locator('option', { hasText: TARGET })).toHaveCount(0);
	await sheet.getByText('Umbuchung', { exact: true }).click();
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill('Urlaubsgeld');
	await sheet.getByLabel('Betrag in €').fill('300');
	await sheet.getByLabel('Von Konto').selectOption({ label: TARGET });
	await sheet.getByLabel('Auf Konto').selectOption({ label: 'Alltagskonto' });
	await sheet.getByLabel('Intervall').selectOption({ label: 'Jährlich' });
	await sheet.getByLabel('Erste Fälligkeit').fill('2030-06-15');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(
		group(page, 'Alltagskonto').getByRole('link', { name: /Urlaubsgeld/ })
	).toContainText(`von ${TARGET}`);
	await expect(group(page, TARGET).getByRole('link', { name: /Urlaubsgeld/ })).toContainText(
		/−300,00\s€/
	);
});

test('the creator keeps editing after losing edit access', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await setAccess(page, SOURCE, LENA.name, 'view');

	await login(page, LENA.username, LENA.password);
	await page.goto('/dauerposten');
	await expect(page.getByRole('button', { name: 'Dauerposten anlegen' })).toHaveCount(0);
	await group(page, SOURCE)
		.getByRole('link', { name: /Sparrate/ })
		.click();
	await openTab(page, 'Bearbeiten');
	await page.getByLabel('Bezeichnung', { exact: true }).fill('Sparrate Erika');
	await page.getByRole('button', { name: 'Sichern', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');
	await expect(page.getByRole('heading', { level: 1, name: 'Sparrate Erika' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Archivieren' })).toBeVisible();
});

test('accounts receiving a transfer cannot be deleted; protocol names the target', async ({
	page
}) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(TARGET) }).click();
	await expect(page.getByRole('button', { name: 'Archivieren' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Konto löschen' })).toHaveCount(0);

	await page.goto('/einstellungen/protokoll?bereich=recurring');
	await page
		.getByRole('button')
		.filter({ hasText: 'Dauerposten angelegt' })
		.filter({ hasText: 'Urlaubsgeld' })
		.click();
	const entry = page.getByRole('dialog', { name: 'Eintrag' });
	await expect(entry.getByText('Zielkonto')).toBeVisible();
	await expect(entry.getByText('Alltagskonto')).toBeVisible();
	await expect(entry.getByText('Umbuchung')).toBeVisible();
});
