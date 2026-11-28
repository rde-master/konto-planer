import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';

// Runs after foundation (admin "erika"), kategorien (default categories without "Wohnen")
// and lockout (user "lena").
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const LENA = { name: 'Lena Sperre', username: 'lena', password: 'lena-richtig-1' };
const ACCOUNT = 'Alltagskonto';

async function login(page: Page, username: string, password: string) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(username);
	await page.getByLabel('Passwort').fill(password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

/** The item in its account group (not in the "Geplante Änderungen" overview). */
function itemLink(page: Page, name: string) {
	return page
		.locator('section:not([aria-label="Geplante Änderungen"])')
		.getByRole('link', { name: new RegExp(name) });
}

async function openCreateSheet(page: Page) {
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	return page.getByRole('dialog', { name: 'Neuer Dauerposten' });
}

test('setup: account shared read-only with lena', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByLabel('Name').fill(ACCOUNT);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await openTab(page, 'Bearbeiten');
	await page.getByLabel(LENA.name).selectOption('view');
	await page.getByRole('button', { name: 'Zugriffe sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Zugriffe gesichert.');
});

test('create a monthly expense; invalid creditor ID is rejected', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.getByRole('navigation').last().getByRole('link', { name: 'Dauerposten' }).click();
	await expect(page.getByText('Noch keine Dauerposten')).toBeVisible();

	const sheet = await openCreateSheet(page);
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill('Streaming');
	await sheet.getByLabel('Betrag in €').fill('12,99');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Kategorie').selectOption({ label: 'Abos und Streaming' });
	await sheet.getByLabel('Erste Fälligkeit').fill('2030-01-31');
	await sheet.getByLabel('Empfänger (optional)').fill('Streamingdienst Muster GmbH');
	await sheet.getByLabel('Zahlart').selectOption({ label: 'Lastschrift' });
	await sheet.getByLabel('Gläubiger-ID (optional)').fill('DE97ZZZ09999999999');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet.getByText(/Diese Gläubiger-ID ist ungültig/)).toBeVisible();
	await expect(sheet.getByLabel('Betrag in €')).toHaveValue('12,99');

	await sheet.getByLabel('Gläubiger-ID (optional)').fill('DE98 ZZZ0 9999 9999 99');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Dauerposten „Streaming“ wurde angelegt.');
	const row = itemLink(page, 'Streaming');
	await expect(row).toContainText('monatlich');
	await expect(row).toContainText('31.01.2030');
	await expect(row).toContainText(/−12,99\s€/);
});

test('income with salary flag and a custom interval', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	let sheet = await openCreateSheet(page);
	await sheet.getByText('Einnahme', { exact: true }).click();
	// Income has no payment method but a salary switch.
	await expect(sheet.getByLabel('Zahlart')).toHaveCount(0);
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill('Gehalt');
	await sheet.getByLabel('Betrag in €').fill('2.500');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByRole('switch', { name: /Gehalt/ }).check();
	await sheet.getByLabel('Erste Fälligkeit').fill('2030-01-28');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(itemLink(page, 'Gehalt')).toContainText(/\+2\.500,00\s€/);
	await expect(itemLink(page, 'Gehalt')).toContainText('Gehalt');

	sheet = await openCreateSheet(page);
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill('Wasser');
	await sheet.getByLabel('Betrag in €').fill('60');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Intervall').selectOption({ label: 'Frei (alle …)' });
	await sheet.getByLabel('Alle', { exact: true }).fill('2');
	await sheet.getByLabel('Einheit').selectOption({ label: 'Monate' });
	await sheet.getByLabel('Erste Fälligkeit').fill('2030-02-15');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(itemLink(page, 'Wasser')).toContainText('alle 2 Monate');

	// Monthly totals: 12,99 + 60/2 expenses, 2.500 income.
	await expect(page.getByRole('region', { name: ACCOUNT })).toContainText(
		/Pro Monat: Ausgaben 42,99\s€ · Einnahmen 2\.500,00\s€/
	);
});

test('due dates clamp to month end; amount history with a future change', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/dauerposten');
	await itemLink(page, 'Streaming').click();
	await expect(page.getByRole('heading', { level: 1, name: 'Streaming' })).toBeVisible();
	const upcoming = page.getByRole('region', { name: 'Nächste Fälligkeiten' });
	await expect(upcoming.getByRole('listitem').nth(0)).toContainText('31.01.2030');
	await expect(upcoming.getByRole('listitem').nth(1)).toContainText('28.02.2030');
	await expect(upcoming.getByRole('listitem').nth(3)).toContainText('30.04.2030');

	await openTab(page, 'Betrag');
	await page.getByRole('button', { name: 'Änderung planen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Änderung planen' });
	await sheet.getByLabel('Betrag in €').fill('14,99');
	await sheet.getByLabel('Gültig ab').fill('2030-03-01');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Betragsverlauf gesichert.');

	await openTab(page, 'Übersicht');
	await expect(upcoming.getByRole('listitem').nth(1)).toContainText(/−12,99\s€/);
	await expect(upcoming.getByRole('listitem').nth(2)).toContainText(/−14,99\s€/);
	await openTab(page, 'Betrag');
	const history = page.getByRole('list', { name: 'Betragsverlauf' });
	await expect(history).toContainText(/ab 01\.03\.2030\s*geplant · 14,99\s€/);
	await expect(history).toContainText(/ab 31\.01\.2030\s*aktuell · 12,99\s€/);
	// Today is before both entries, so the earliest amount counts now.
	await expect(page.getByTestId('current-amount')).toHaveText(/−12,99\s€/);

	// The same date twice is refused.
	await page.getByRole('button', { name: 'Änderung planen' }).click();
	await sheet.getByLabel('Betrag in €').fill('15');
	await sheet.getByLabel('Gültig ab').fill('2030-03-01');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet.getByText('Für dieses Datum gibt es schon einen Betrag.')).toBeVisible();
	await sheet.getByRole('button', { name: 'Abbrechen' }).click();

	// Edit fields: quarterly instead of monthly.
	await openTab(page, 'Bearbeiten');
	await page.getByLabel('Intervall').selectOption({ label: 'Vierteljährlich' });
	await page.getByRole('button', { name: 'Sichern', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');
	await openTab(page, 'Übersicht');
	await expect(upcoming.getByRole('listitem').nth(1)).toContainText('30.04.2030');
});

test('lena can only view; edits are refused on the server', async ({ page }) => {
	await login(page, LENA.username, LENA.password);
	await page.goto('/dauerposten');
	await expect(page.getByRole('button', { name: 'Dauerposten anlegen' })).toHaveCount(0);
	await itemLink(page, 'Streaming').click();
	await expect(page.getByText('Du kannst diesen Dauerposten nur ansehen.')).toBeVisible();
	await openTab(page, 'Betrag');
	await expect(page.getByRole('button', { name: 'Änderung planen' })).toHaveCount(0);
	// No tab for editing and managing at all.
	await expect(page.getByRole('tab', { name: 'Bearbeiten' })).toHaveCount(0);
	const res = await page.request.post(`${page.url()}?/amountAdd`, {
		form: { amount: '1', validFrom: '2031-01-01' },
		headers: { origin: test.info().project.use.baseURL!, 'x-sveltekit-action': 'true' }
	});
	expect(await res.text()).toContain('Du darfst diesen Dauerposten nicht bearbeiten.');
});

test('archive, restore, delete; accounts with items cannot be deleted', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/dauerposten');
	await itemLink(page, 'Wasser').click();
	await openTab(page, 'Bearbeiten');
	await page.getByRole('button', { name: 'Archivieren' }).click();
	await expect(page.getByRole('status')).toHaveText('Dauerposten archiviert.');
	await openTab(page, 'Übersicht');
	await expect(page.getByText('Archivierte Dauerposten sind schreibgeschützt.')).toBeVisible();
	await page.goto('/dauerposten');
	await expect(page.getByRole('heading', { name: 'Archiviert' })).toBeVisible();
	await itemLink(page, 'Wasser').click();
	await openTab(page, 'Bearbeiten');
	await page.getByRole('button', { name: 'Wiederherstellen' }).click();
	await expect(page.getByRole('status')).toHaveText('Dauerposten wiederhergestellt.');

	await page.getByRole('button', { name: 'Dauerposten löschen' }).click();
	await page
		.getByRole('dialog', { name: 'Dauerposten löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page).toHaveURL('/dauerposten');
	await expect(itemLink(page, 'Wasser')).toHaveCount(0);

	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await openTab(page, 'Bearbeiten');
	await expect(page.getByRole('button', { name: 'Archivieren' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Konto löschen' })).toHaveCount(0);
});

test('changes appear in the protocol', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/einstellungen/protokoll?bereich=recurring');
	for (const title of [
		'Dauerposten angelegt',
		'Betrag geändert',
		'Dauerposten geändert',
		'Dauerposten archiviert',
		'Dauerposten gelöscht'
	]) {
		await expect(page.getByRole('button').filter({ hasText: title }).first()).toBeVisible();
	}
	await page.getByRole('button').filter({ hasText: 'Dauerposten geändert' }).click();
	const entry = page.getByRole('dialog', { name: 'Eintrag' });
	await expect(entry.getByText('Intervall')).toBeVisible();
	await expect(entry.getByText('vierteljährlich')).toBeVisible();
});
