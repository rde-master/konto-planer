import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Price and subscription watch: higher amounts and new regular debits from the import.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Wächterkonto';
const IBAN = 'DE75512108001245126199';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('a higher amount shows up as price increase', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('IBAN (optional)').fill(IBAN);
	await account.getByLabel('Betrag in €').fill('2.000');
	await account.getByLabel('Stand am').fill(addDays(today, -60));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const create = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await create.getByLabel('Bezeichnung').fill('Videodienst Wächter');
	await create.getByLabel('Betrag in €').fill('10');
	await create.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await create.getByLabel('Erste Fälligkeit').fill(addDays(today, 5));
	await create.getByRole('button', { name: 'Anlegen' }).click();
	await expect(create).toBeHidden();

	await page.getByRole('link', { name: /Videodienst Wächter/ }).click();
	await page.getByRole('button', { name: 'Änderung planen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Änderung planen' });
	await sheet.getByLabel('Gültig ab').fill(addDays(today, 30));
	await sheet.getByLabel('Betrag in €').fill('12');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();

	await page.goto('/');
	const row = page
		.getByRole('region', { name: 'Teurer geworden' })
		.getByRole('link', { name: 'Videodienst Wächter' });
	await expect(row).toContainText(/10,00\s€ → 12,00\s€/);
	await expect(row).toContainText('+20 %');
	await expect(row).toContainText(/\+24,00\s€\/Jahr/);
});

test('a new regular debit from the import can become a recurring item', async ({ page }) => {
	await login(page);
	const day = (d: string) => d.split('-').reverse().join('.');
	const header =
		'Bezeichnung Auftragskonto;IBAN Auftragskonto;BIC Auftragskonto;Bankname Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;BIC (SWIFT-Code) Zahlungsbeteiligter;Buchungstext;Verwendungszweck;Betrag;Waehrung;Saldo nach Buchung;Bemerkung;Kategorie;Gekennzeichneter Umsatz;Glaeubiger ID;Mandatsreferenz';
	const row = (date: string, payee: string, iban: string, purpose: string, amount: string) =>
		`${ACCOUNT};${IBAN};GENODEF1XXX;Musterbank eG;${day(date)};${day(date)};${payee};${iban};TESTDEFFXXX;Lastschrift;${purpose};${amount};EUR;;;;;;`;
	const music = 'DE02120300000000202051';
	const rows = [
		row(addDays(today, -40), 'Musikdienst Beispiel', music, 'Abo Musik', '-9,99'),
		row(addDays(today, -10), 'Musikdienst Beispiel', music, 'Abo Musik', '-9,99'),
		row(addDays(today, -12), 'Bäckerei Wächter', '', 'Brot', '-4,20')
	];
	const buffer = Buffer.from([header, ...rows].join('\r\n') + '\r\n', 'latin1');

	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await page.getByRole('link', { name: 'CSV importieren' }).click();
	await page
		.getByLabel('CSV-Datei')
		.setInputFiles({ name: 'waechter.csv', mimeType: 'text/csv', buffer });
	await page.getByRole('button', { name: 'Vorschau zeigen' }).click();
	await expect(page.getByRole('region', { name: 'Neue Dauerposten' })).toContainText(
		'Musikdienst Beispiel'
	);
	// Not taken over now: the start page asks later.
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Import übernommen' })).toBeVisible();

	await page.goto('/');
	const hint = page
		.getByRole('region', { name: 'Neues Abo?' })
		.getByRole('listitem', { name: 'Musikdienst Beispiel' });
	await expect(hint).toContainText(/2\s+Zahlungen/);
	await expect(hint).toContainText(/9,99\s€/);
	await hint.getByRole('button', { name: 'Als Dauerposten anlegen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Musikdienst Beispiel' })).toBeVisible();

	await page.goto('/');
	await expect(
		page.getByRole('region', { name: 'Neues Abo?' }).getByRole('listitem', {
			name: 'Musikdienst Beispiel'
		})
	).toHaveCount(0);
});
