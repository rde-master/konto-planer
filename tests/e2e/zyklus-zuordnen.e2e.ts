import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Payments the import does not recognise are assigned to their recurring item by hand.
// Uses the card of zyklus-kreditkarte.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const CARD = 'Musterkarte';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function createItem(page: Page, name: string, amount: string) {
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const create = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await create.getByLabel('Bezeichnung', { exact: true }).fill(name);
	await create.getByLabel('Betrag in €').fill(amount);
	await create.getByLabel('Konto').selectOption({ label: CARD });
	await create.getByLabel('Erste Fälligkeit').fill(addDays(today, -3));
	await create.getByRole('button', { name: 'Anlegen' }).click();
	await expect(create).toBeHidden();
}

/** Bookings in the list with this text and amount (the amount keeps the filter chip out). */
async function found(page: Page, text: string, amount: string) {
	await page.goto(`/buchungen?q=${encodeURIComponent(text)}`);
	return page.getByRole('main').getByRole('link', { name: new RegExp(`${text}.*${amount}`) });
}

test('a row of the file is assigned in the preview; the name is remembered', async ({ page }) => {
	await login(page);
	await createItem(page, 'Lesezirkel Karte', '7,50');
	// The due date is booked provisionally.
	await expect(await found(page, 'Lesezirkel Karte', '7,50')).toHaveCount(1);

	const day = (d: string) => d.split('-').reverse().join('.');
	const header =
		'Bezeichnung Auftragskonto;IBAN Auftragskonto;BIC Auftragskonto;Bankname Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;BIC (SWIFT-Code) Zahlungsbeteiligter;Buchungstext;Verwendungszweck;Betrag;Waehrung;Saldo nach Buchung;Bemerkung;Kategorie;Gekennzeichneter Umsatz;Glaeubiger ID;Mandatsreferenz';
	const row = (date: string, name: string, amount: string) =>
		`Kreditkarte Muster;;;Musterbank eG;${day(date)};${day(date)};${name};;;Kartenzahlung;Heft;${amount};EUR;;;;;;`;
	const file = (name: string, line: string) => ({
		name,
		mimeType: 'text/csv',
		buffer: Buffer.from([header, line].join('\r\n') + '\r\n', 'latin1')
	});

	// Another name, another amount: nothing the app could know it by.
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(CARD) }).click();
	await page.getByRole('link', { name: 'CSV importieren' }).click();
	await page
		.getByLabel('CSV-Datei')
		.setInputFiles(file('zirkel.csv', row(addDays(today, -1), 'KIOSK ZENTRAL 4711', '-8,10')));
	await page.getByRole('button', { name: 'Vorschau zeigen' }).click();
	const line = page.getByRole('listitem', { name: 'Zeile 2' });
	await expect(line).toContainText('neu');
	await line.getByLabel('Zeile 2 zuordnen').selectOption({ label: 'Lesezirkel Karte' });
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Import übernommen' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Ergebnis' })).toContainText(
		'1 Dauerposten oder Buchungen zugeordnet'
	);

	// The real payment took the place of the provisional booking.
	await expect(await found(page, 'Lesezirkel Karte', '7,50')).toHaveCount(0);
	await (await found(page, 'KIOSK ZENTRAL', '8,10')).click();
	await expect(page.getByRole('link', { name: /Dauerposten.*Lesezirkel Karte/ })).toBeVisible();

	// The item knows the name now …
	await page.getByRole('link', { name: /Dauerposten.*Lesezirkel Karte/ }).click();
	await openTab(page, 'Mehr');
	const names = page.getByRole('region', { name: 'Namen im Import' });
	await expect(names).toContainText('kiosk zentral');

	// … so the next file is recognised without help (next month's due date, another number).
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(CARD) }).click();
	await page.getByRole('link', { name: 'CSV importieren' }).click();
	await page
		.getByLabel('CSV-Datei')
		.setInputFiles(file('zirkel-2.csv', row(today, 'KIOSK ZENTRAL 0815', '-8,10')));
	await page.getByRole('button', { name: 'Vorschau zeigen' }).click();
	// Today's payment is too far from the next due date: the name alone is not enough.
	await expect(page.getByRole('listitem', { name: 'Zeile 2' })).toContainText('neu');
	await page.getByRole('button', { name: 'Abbrechen' }).click();

	// Forgetting the name is possible at the item.
	await page.goto('/dauerposten');
	await page.getByRole('link', { name: /Lesezirkel Karte/ }).click();
	await openTab(page, 'Mehr');
	await page.getByRole('button', { name: 'kiosk zentral entfernen' }).click();
	await expect(page.getByRole('region', { name: 'Namen im Import' })).toHaveCount(0);
});

test('a booking is assigned at the booking and released again', async ({ page }) => {
	await login(page);
	await createItem(page, 'Parkhaus Karte', '12');
	await expect(await found(page, 'Parkhaus Karte', '12,00')).toHaveCount(1);

	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('12,40');
	await sheet.getByLabel('Konto').selectOption({ label: CARD });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill('Garage Nord');
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	await (await found(page, 'Garage Nord', '12,40')).click();
	await openTab(page, 'Aktionen');
	await page.getByRole('button', { name: 'Dauerposten zuordnen' }).click();
	const assign = page.getByRole('dialog', { name: 'Dauerposten zuordnen' });
	await assign.getByLabel('Dauerposten').selectOption({ label: 'Parkhaus Karte' });
	await assign.getByRole('button', { name: 'Zuordnen' }).click();
	await expect(assign).toBeHidden();
	await expect(page.getByRole('status')).toContainText(
		'Dem Dauerposten „Parkhaus Karte“ zugeordnet.'
	);
	await expect(page.getByRole('status')).toContainText('gilt als bezahlt');
	await expect(page.getByRole('button', { name: 'Dauerposten zuordnen' })).toHaveCount(0);
	await openTab(page, 'Buchung');
	await expect(page.getByRole('link', { name: /Dauerposten.*Parkhaus Karte/ })).toBeVisible();
	// No longer twice: the provisional booking is gone.
	await expect(await found(page, 'Parkhaus Karte', '12,00')).toHaveCount(0);

	// Released: the due date is open and booked provisionally again.
	await (await found(page, 'Garage Nord', '12,40')).click();
	await openTab(page, 'Aktionen');
	await page.getByRole('button', { name: 'Zuordnung lösen' }).click();
	const release = page.getByRole('dialog', { name: 'Zuordnung lösen' });
	await release.getByRole('button', { name: 'Lösen' }).click();
	await expect(release).toBeHidden();
	await expect(page.getByRole('status')).toContainText('Zuordnung zu „Parkhaus Karte“ gelöst.');
	await expect(page.getByRole('button', { name: 'Dauerposten zuordnen' })).toBeVisible();
	await expect(await found(page, 'Parkhaus Karte', '12,00')).toHaveCount(1);
});
