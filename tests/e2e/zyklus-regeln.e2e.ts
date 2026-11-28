import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Category rules with several conditions that must all hold – also by the bank's booking
// text and category. Uses the card of zyklus-kreditkarte.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const CARD = 'Musterkarte';
const SHOP = 'PIXELSHOP ONLINE';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

const day = (d: string) => d.split('-').reverse().join('.');
const HEADER =
	'Bezeichnung Auftragskonto;IBAN Auftragskonto;BIC Auftragskonto;Bankname Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;BIC (SWIFT-Code) Zahlungsbeteiligter;Buchungstext;Verwendungszweck;Betrag;Waehrung;Saldo nach Buchung;Bemerkung;Kategorie;Gekennzeichneter Umsatz;Glaeubiger ID;Mandatsreferenz';
/** A card payment at the shop with the bank's own category. */
const line = (date: string, number: string, amount: string, bankCategory: string) =>
	`Kreditkarte Muster;;;Musterbank eG;${day(date)};${day(date)};${SHOP} ${number};;;Kartenzahlung;Bestellung;${amount};EUR;;;${bankCategory};;;`;

async function importFile(page: Page, name: string, lines: string[]) {
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(CARD) }).click();
	await page.getByRole('link', { name: 'CSV importieren' }).click();
	await page.getByLabel('CSV-Datei').setInputFiles({
		name,
		mimeType: 'text/csv',
		buffer: Buffer.from([HEADER, ...lines].join('\r\n') + '\r\n', 'latin1')
	});
	await page.getByRole('button', { name: 'Vorschau zeigen' }).click();
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Import übernommen' })).toBeVisible();
}

/** The booking of the shop with this amount in the list. */
async function row(page: Page, amount: string) {
	await page.goto(`/buchungen?q=${encodeURIComponent(SHOP)}`);
	return page.getByRole('main').getByRole('link', { name: new RegExp(`${SHOP}.*${amount}`) });
}

test('a rule from a booking can require the bank’s category as well', async ({ page }) => {
	await login(page);
	await importFile(page, 'pixel.csv', [
		line(addDays(today, -1), '1001', '-9,37', 'Pixelkram'),
		line(addDays(today, -1), '1002', '-5,13', 'Sonderkram')
	]);
	await expect(await row(page, '9,37')).toContainText('Ohne Kategorie');

	await (await row(page, '9,37')).click();
	await openTab(page, 'Aktionen');
	await page.getByRole('button', { name: 'Immer so einordnen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Immer so einordnen' });
	// Everything the booking can be known by is offered; the payee is ticked.
	await expect(sheet.getByLabel('Empfänger/Zahler enthält')).toBeChecked();
	await expect(sheet.getByLabel('Text Empfänger/Zahler')).toHaveValue(SHOP);
	await expect(sheet.getByLabel('Buchungstext ist gleich')).not.toBeChecked();
	await expect(sheet.getByLabel('Text Buchungstext')).toHaveValue('Kartenzahlung');
	await expect(sheet.getByLabel('Text Kategorie der Bank')).toHaveValue('Pixelkram');

	// Nothing ticked is no rule.
	await sheet.getByLabel('Empfänger/Zahler enthält').uncheck();
	await sheet.getByLabel('Kategorie', { exact: true }).selectOption({ label: 'Drogerie' });
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet.getByText('Bitte mindestens ein Merkmal ankreuzen.')).toBeVisible();

	await sheet.getByLabel('Empfänger/Zahler enthält').check();
	await sheet.getByLabel('Kategorie der Bank ist gleich').check();
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toContainText(
		`Empfänger/Zahler enthält „${SHOP}“ und Kategorie der Bank ist gleich „Pixelkram“ → Haushalt › Drogerie`
	);
	// The other payment of the shop has another bank category: not all conditions hold.
	await expect(page.getByRole('status')).toContainText('Keine weitere Buchung ohne Kategorie');
	await expect(await row(page, '9,37')).toContainText('Drogerie');
	await expect(await row(page, '5,13')).toContainText('Ohne Kategorie');
});

test('a rule gets further conditions on the rules page', async ({ page }) => {
	await login(page);
	await page.goto('/kategorien/regeln');
	await page.getByRole('button', { name: 'Regel anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Regel' });
	await sheet.getByLabel('Wenn', { exact: true }).selectOption({ label: 'Empfänger/Zahler' });
	await sheet.getByLabel('Text', { exact: true }).fill('pixelshop');
	await sheet.getByRole('button', { name: 'Weitere Bedingung' }).click();
	await sheet.getByLabel('Wenn (2)').selectOption({ label: 'Kategorie der Bank' });
	await sheet.getByLabel('Bedingung (2)').selectOption({ label: 'ist gleich' });
	await sheet.getByLabel('Text (2)').fill('Sonderkram');
	// A row left empty is simply no condition.
	await sheet.getByRole('button', { name: 'Weitere Bedingung' }).click();
	await sheet.getByLabel('Dann Kategorie').selectOption({ label: 'Supermarkt' });
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Regel angelegt.');

	const rules = page.getByRole('region', { name: 'Regeln' });
	const label =
		'Empfänger/Zahler enthält „pixelshop“ und Kategorie der Bank ist gleich „Sonderkram“';
	await expect(rules).toContainText(label);

	await page.getByRole('button', { name: 'Auf bisherige Buchungen anwenden' }).click();
	await expect(page.getByRole('status')).toContainText('Kategorie bekommen');
	await expect(await row(page, '5,13')).toContainText('Supermarkt');
	await expect(await row(page, '9,37')).toContainText('Drogerie');

	// The conditions are there when the rule is opened again; one can be removed.
	await page.goto('/kategorien/regeln');
	await rules.getByRole('button', { name: new RegExp('pixelshop') }).click();
	const edit = page.getByRole('dialog', { name: 'Regel', exact: true });
	await expect(edit.getByLabel('Text (2)')).toHaveValue('Sonderkram');
	await edit.getByRole('button', { name: 'Bedingung 2 entfernen' }).click();
	await edit.getByRole('button', { name: 'Sichern' }).click();
	await expect(edit).toBeHidden();
	await expect(rules).not.toContainText(label);
	await expect(rules).toContainText('Empfänger/Zahler enthält „pixelshop“');
});

test('the next import gets the category when all conditions hold', async ({ page }) => {
	await login(page);
	await importFile(page, 'pixel-2.csv', [
		line(today, '1003', '-3,21', 'Pixelkram'),
		line(today, '1004', '-2,19', 'Wolkenkram')
	]);
	// Payee and bank category: the rule made at the booking, first in the list.
	await expect(await row(page, '3,21')).toContainText('Drogerie');
	// Only the payee: the rule of the rules page.
	await expect(await row(page, '2,19')).toContainText('Supermarkt');
});
