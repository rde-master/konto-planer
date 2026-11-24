import { expect, test, type Page } from '@playwright/test';

// Imports the fictional Volksbank export (tests/fixtures) into its own giro account.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Musterkonto';
const IBAN = 'DE09 1234 5678 0001 2345 67';
const FIXTURE = 'tests/fixtures/volksbank-beispiel.csv';

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openAccount(page: Page) {
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await expect(page.getByRole('heading', { level: 1, name: ACCOUNT })).toBeVisible();
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

test('preview: duplicates, replaced provisional bookings, wrong account', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByLabel('Name').fill(ACCOUNT);
	await sheet.getByLabel('IBAN (optional)').fill(IBAN);
	await sheet.getByLabel('Betrag in €').fill('1.000');
	await sheet.getByLabel('Stand am').fill('2026-09-30');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	// Provisionally booked electricity on 02.10. and 02.11.
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const item = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await item.getByLabel('Bezeichnung').fill('Energie');
	await item.getByLabel('Betrag in €').fill('64');
	await item.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await item.getByLabel('Erste Fälligkeit').fill('2026-10-02');
	await item.getByRole('button', { name: 'Anlegen' }).click();
	await expect(item).toBeHidden();

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
	await expect(summary.getByLabel('Ersetzt')).toHaveText('2 ersetzen eine Buchung');
	await expect(summary.getByLabel('Schon vorhanden')).toHaveText('1 schon vorhanden');
	await expect(summary).toContainText('Eine Anpassung');
	await expect(page.getByRole('list', { name: 'Buchungen der Datei' })).toContainText(
		'vorläufige Buchung vom 02.11.2026'
	);
});

test('taking over stores the bookings and checks the balance', async ({ page }) => {
	await login(page);
	await upload(page, FIXTURE);
	// Leave out the supermarket (line 8).
	await page.getByRole('checkbox', { name: 'Zeile 8 übernehmen' }).uncheck();
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Import übernommen' })).toBeVisible();
	const result = page.getByRole('region', { name: 'Ergebnis' });
	await expect(result).toContainText('7 neue Buchungen');
	await expect(result).toContainText('2 manuelle oder vorläufige Buchungen ersetzt');
	await expect(result).toContainText('2 übersprungen');
	await expect(result).toContainText('1 Anpassungen aufgelöst');

	// The bank started with 1.010 € (the app with 1.000 €) and has the supermarket (−45,67 €).
	const saldo = page.getByRole('region', { name: 'Saldo' });
	await expect(saldo.getByLabel('Differenz')).toHaveText(/−35,67\s€/);
	await page.getByRole('button', { name: 'Differenz als Anpassung buchen' }).click();
	await expect(saldo.getByLabel('Differenz')).toHaveText('stimmt');

	// The provisional due items are booked now.
	await page.goto('/dauerposten');
	await page.getByRole('link', { name: /^Energie/ }).click();
	await expect(page.getByRole('region', { name: 'Letzte Fälligkeiten' })).toContainText('gebucht');
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
