import { expect, test, type Page } from '@playwright/test';

// Imports the fictional Volksbank export (tests/fixtures) into its own giro account.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Musterkonto';
const SAVINGS = 'Mustersparbuch';
const FIXTURE = 'tests/fixtures/volksbank-beispiel.csv';

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openAccount(page: Page, name = ACCOUNT) {
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(name) }).click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

async function createAccount(page: Page, name: string, iban: string, savings = false) {
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	if (savings) await sheet.getByText('Sparbuch', { exact: true }).click();
	await sheet.getByLabel('Name').fill(name);
	await sheet.getByLabel('IBAN (optional)').fill(iban);
	await sheet.getByLabel('Betrag in €').fill('1.000');
	await sheet.getByLabel('Stand am').fill('2026-09-30');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

async function createItem(page: Page, name: string, amount: string, first: string) {
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const item = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await item.getByLabel('Bezeichnung').fill(name);
	await item.getByLabel('Betrag in €').fill(amount);
	await item.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await item.getByLabel('Erste Fälligkeit').fill(first);
	await item.getByRole('button', { name: 'Anlegen' }).click();
	await expect(item).toBeHidden();
}

async function upload(
	page: Page,
	file: string | { name: string; mimeType: string; buffer: Buffer }
) {
	await openAccount(page);
	await page.getByRole('link', { name: 'CSV importieren' }).click();
	await page.getByLabel('CSV-Datei').setInputFiles(file);
	await page.getByRole('button', { name: 'Vorschau zeigen' }).click();
}

test('preview: recurring items, transfers, suggestions, missing bookings', async ({ page }) => {
	await login(page);
	await createAccount(page, ACCOUNT, 'DE09 1234 5678 0001 2345 67');
	await createAccount(page, SAVINGS, 'DE25 1234 5678 0007 6543 21', true);
	// Electricity as in the file, and an insurance that is missing in the file.
	await createItem(page, 'Energie', '64', '2026-10-02');
	await createItem(page, 'Hausrat', '30', '2026-10-12');

	// An adjustment inside the file's period is removed by the import.
	await openAccount(page);
	await page.getByRole('button', { name: 'Kontostand korrigieren' }).click();
	const adjust = page.getByRole('dialog', { name: 'Kontostand korrigieren' });
	await adjust.getByLabel('Tatsächlicher Stand in €').fill('3.000');
	await adjust.getByLabel('Stand am').fill('2026-10-20');
	await adjust.getByRole('button', { name: 'Korrigieren' }).click();
	await expect(adjust).toBeHidden();

	await upload(page, {
		name: 'fremd.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(
			'IBAN Auftragskonto;Buchungstag;Betrag;Waehrung\nDE25123456780007654321;01.10.2026;1,00;EUR\n'
		)
	});
	await expect(page.getByRole('alert')).toContainText('gehört zum Konto DE25');

	await upload(page, FIXTURE);
	await expect(page.getByRole('heading', { level: 1, name: 'Vorschau' })).toBeVisible();
	const summary = page.getByRole('region', { name: 'Zusammenfassung' });
	await expect(summary).toContainText('Windows-1252');
	await expect(summary.getByLabel('Neu')).toHaveText('8 neu');
	await expect(summary.getByLabel('Dauerposten')).toHaveText('2 zu Dauerposten');
	await expect(summary.getByLabel('Schon vorhanden')).toHaveText('1 schon vorhanden');
	await expect(summary).toContainText('Eine Anpassung');

	const list = page.getByRole('list', { name: 'Buchungen der Datei' });
	await expect(list.getByRole('listitem', { name: 'Zeile 5' })).toContainText(
		'Dauerposten „Energie“ (Betrag und Datum)'
	);
	await expect(list.getByRole('listitem', { name: 'Zeile 4' })).toContainText(
		`Umbuchung, Gegenbuchung auf ${SAVINGS}`
	);
	// The bank's category "Einkommen" is an own category.
	await expect(list.getByRole('listitem', { name: 'Zeile 7' })).toContainText(
		'Kategorie: Einkommen'
	);

	const suggestions = page.getByRole('region', { name: 'Neue Dauerposten' });
	await expect(suggestions).toContainText('Beispiel Maschinenbau GmbH');
	await expect(suggestions).toContainText('Hausverwaltung Beispiel');
	await expect(suggestions).not.toContainText('Stadtwerke');

	const missing = page.getByRole('region', { name: 'Ohne echte Buchung' });
	await expect(missing.getByRole('link', { name: /Hausrat/ })).toHaveCount(2);
});

test('taking over: bookings, counter bookings, new items, balance check', async ({ page }) => {
	await login(page);
	await upload(page, FIXTURE);
	// Leave out the supermarket (line 8); create the salary as recurring item.
	await page.getByRole('checkbox', { name: 'Zeile 8 übernehmen' }).uncheck();
	await page
		.getByRole('checkbox', { name: 'Beispiel Maschinenbau GmbH als Dauerposten anlegen' })
		.check();
	await page
		.getByRole('region', { name: 'Neue Dauerposten' })
		.getByRole('checkbox', { name: /Gehalt/ })
		.check();
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Import übernommen' })).toBeVisible();
	const result = page.getByRole('region', { name: 'Ergebnis' });
	await expect(result).toContainText('7 neue Buchungen');
	await expect(result).toContainText('2 Dauerposten oder Buchungen zugeordnet');
	await expect(result).toContainText('2 übersprungen');
	await expect(result).toContainText('1 Anpassungen aufgelöst');
	await expect(page.getByRole('region', { name: 'Ohne echte Buchung' })).toContainText('Hausrat');

	// The bank started with 1.010 € (the app with 1.000 €) and has the supermarket (−45,67 €),
	// but not the missing insurance (2 × 30 €, still provisional).
	const saldo = page.getByRole('region', { name: 'Saldo' });
	await expect(saldo.getByLabel('Differenz')).toHaveText(/24,33\s€/);
	await page.getByRole('button', { name: 'Differenz als Anpassung buchen' }).click();
	await expect(saldo.getByLabel('Differenz')).toHaveText('stimmt');

	// Counter bookings: 2 × 200 € on the savings account.
	await openAccount(page, SAVINGS);
	await expect(page.getByLabel('Kontostand', { exact: true })).toHaveText(/1\.400,00\s€/);

	// The salary is a recurring item now; the electricity's due items are booked.
	await page.goto('/dauerposten');
	await expect(page.getByRole('link', { name: /^Beispiel Maschinenbau GmbH/ })).toBeVisible();
	await page.getByRole('link', { name: /^Energie/ }).click();
	await expect(page.getByRole('region', { name: 'Letzte Fälligkeiten' })).toContainText('gebucht');
});

test('the category of an imported booking can be changed', async ({ page }) => {
	await login(page);
	await page.goto('/buchungen');
	await page.getByRole('link', { name: /Café Übersee/ }).click();
	await expect(page.locator('main')).toContainText('Kategorie der Bank');
	// Closed sheets stay in the DOM; role queries only see the visible select.
	const select = page.getByRole('combobox', { name: 'Kategorie', exact: true });
	await select.selectOption({ label: 'Abos und Streaming' });
	await page.waitForLoadState('networkidle');
	await page.reload();
	await expect(
		page.getByRole('combobox', { name: 'Kategorie', exact: true }).locator('option:checked')
	).toHaveText('Abos und Streaming');
});

test('importing again only offers what is missing', async ({ page }) => {
	await login(page);
	await upload(page, FIXTURE);
	const summary = page.getByRole('region', { name: 'Zusammenfassung' });
	await expect(summary.getByLabel('Neu')).toHaveText('1 neu');
	await expect(summary.getByLabel('Schon vorhanden')).toHaveText('10 schon vorhanden');
	await page.getByRole('button', { name: 'Abbrechen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Import' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Letzte Importe' })).toContainText('7 neu');

	await page.goto('/einstellungen/protokoll?bereich=import');
	await expect(
		page.getByRole('button').filter({ hasText: 'Import angelegt' }).first()
	).toBeVisible();
});

test('the latest import can be undone completely', async ({ page }) => {
	await login(page);
	await openAccount(page);
	await page.getByRole('link', { name: 'CSV importieren' }).click();
	await page.getByRole('button', { name: 'Letzten Import rückgängig machen' }).click();
	await page
		.getByRole('dialog', { name: 'Import rückgängig' })
		.getByRole('button', { name: 'Rückgängig machen' })
		.click();
	await expect(page.getByRole('status')).toHaveText('Import zurückgenommen.');
	await expect(page.getByRole('region', { name: 'Letzte Importe' })).toContainText(
		'rückgängig gemacht'
	);
	await expect(page.getByRole('button', { name: 'Letzten Import rückgängig machen' })).toHaveCount(
		0
	);

	// Counter bookings are gone, the suggested item is deleted, due items are provisional again.
	await openAccount(page, SAVINGS);
	await expect(page.getByLabel('Kontostand', { exact: true })).toHaveText(/1\.000,00\s€/);
	await page.goto('/dauerposten');
	await expect(page.getByRole('link', { name: /^Beispiel Maschinenbau GmbH/ })).toHaveCount(0);
	await page.getByRole('link', { name: /^Energie/ }).click();
	await expect(page.getByRole('region', { name: 'Letzte Fälligkeiten' })).toContainText(
		'vorläufig gebucht'
	);

	// The file can be imported as before.
	await upload(page, FIXTURE);
	const summary = page.getByRole('region', { name: 'Zusammenfassung' });
	await expect(summary.getByLabel('Dauerposten')).toHaveText('2 zu Dauerposten');
	await expect(summary.getByLabel('Schon vorhanden')).toHaveText('1 schon vorhanden');
	// The restored adjustment plus the one booked after the import ("Differenz als Anpassung").
	await expect(summary).toContainText('2 Anpassungen');
	await page.getByRole('button', { name: 'Abbrechen' }).click();

	await page.goto('/einstellungen/protokoll?bereich=import');
	await expect(
		page.getByRole('button').filter({ hasText: 'Import rückgängig gemacht' }).first()
	).toBeVisible();
});
