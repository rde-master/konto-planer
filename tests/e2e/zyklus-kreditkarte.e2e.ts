import { expect, test, type Page } from '@playwright/test';
import { formatDay, todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';
import { debitDateFor, statementDates } from '../../src/lib/credit-card';

// Credit card: monthly settlement from a giro account, also in the giro account's plan.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const GIRO = 'Abrechnungskonto Karte';
const CARD = 'Musterkarte';
const today = todayBerlin();
const opening = addDays(today, -34);
// Statement about ten days ago, debit about five days ago: one settlement is already due.
const statementDay = Number(addDays(today, -10).slice(8));
const debitDay = Number(addDays(today, -5).slice(8));
const last = statementDates(statementDay, opening, today).at(-1)!;
const next = statementDates(statementDay, addDays(today, 1), addDays(today, 40))[0];
const nextDebit = debitDateFor(next, debitDay);

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openAccount(page: Page, name: string) {
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(name) }).click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

async function book(page: Page, amount: string, date: string, payee: string) {
	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill(amount);
	await sheet.getByLabel('Konto').selectOption({ label: CARD });
	await sheet.getByLabel('Datum').fill(date);
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(payee);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
}

const balance = (page: Page) => page.getByLabel('Kontostand', { exact: true });

test('a credit card is settled from its giro account', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	let sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByLabel('Name').fill(GIRO);
	await sheet.getByLabel('Betrag in €').fill('1.000');
	await sheet.getByLabel('Stand am').fill(opening);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByText('Kreditkarte', { exact: true }).click();
	await sheet.getByLabel('Name').fill(CARD);
	await sheet.getByLabel('Betrag in €').fill('0');
	await sheet.getByLabel('Stand am').fill(opening);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet.getByText('Bitte das Girokonto für die Abbuchung wählen.')).toBeVisible();
	await sheet.getByLabel('Abbuchung von').selectOption({ label: GIRO });
	await sheet.getByLabel('Abrechnungstag (1–31)').fill(String(statementDay));
	await sheet.getByLabel('Abbuchungstag (1–31)').fill(String(debitDay));
	await sheet.getByLabel('Kreditrahmen in € (optional)').fill('500');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('heading', { name: 'Kreditkarten' })).toBeVisible();

	// A purchase before the last statement is debited from the giro account.
	await book(page, '80', addDays(last, -4), 'Buchhandlung Karte');
	await openAccount(page, GIRO);
	await expect(balance(page)).toHaveText(/920,00\s€/);
	await openAccount(page, CARD);
	await expect(balance(page)).toHaveText(/0,00\s€/);

	// A purchase today goes into the next statement.
	await book(page, '150', today, 'Tankstelle Karte');
	await openAccount(page, CARD);
	const billing = page.getByRole('region', { name: 'Abrechnung' });
	await expect(
		billing.getByRole('listitem', { name: `Abrechnung ${formatDay(next)}` })
	).toContainText(/150,00\s€/);
	await expect(billing).toContainText(`Abbuchung ${formatDay(nextDebit)} von ${GIRO}`);
	await expect(billing).toContainText(/350,00\s€ von 500,00\s€/);
});

test('the next settlement counts in the giro plan; late purchases correct the last one', async ({
	page
}) => {
	await login(page);
	await openAccount(page, GIRO);
	await page.getByRole('button', { name: /Stichtag/ }).click();
	const cutoff = page.getByRole('dialog', { name: 'Stichtag' });
	await cutoff.getByLabel('Rechnen bis').selectOption({ label: 'Festes Datum' });
	await cutoff.getByLabel('Datum').fill(addDays(nextDebit, 1));
	await cutoff.getByRole('button', { name: 'Sichern' }).click();
	await expect(cutoff).toBeHidden();
	await expect(page.getByLabel('Mindestbestand', { exact: true })).toHaveText(/150,00\s€/);
	await expect(page.getByLabel('Verfügbar', { exact: true })).toHaveText(/770,00\s€/);
	await expect(page.getByRole('region', { name: 'Bis zum Stichtag fällig' })).toContainText(
		`Kreditkarte ${CARD}`
	);

	// The statement is listed among the open payments: out of the giro account, into the card.
	await page.goto('/offene-zahlungen?tage=90');
	const debit = page.getByRole('region', { name: formatDay(nextDebit) });
	await expect(debit.getByRole('link', { name: new RegExp(`Kreditkarte ${CARD}`) })).toContainText(
		/−150,00\s€/
	);
	await expect(
		debit.getByRole('link', { name: new RegExp(`Abbuchung von ${GIRO}`) })
	).toContainText(/\+150,00\s€/);

	// A purchase entered late (before the last statement) raises the settlement already booked.
	await book(page, '20', addDays(last, -2), 'Nachzügler Karte');
	await openAccount(page, GIRO);
	await expect(balance(page)).toHaveText(/900,00\s€/);

	await page.goto('/buchungen?q=Kreditkartenabrechnung');
	await expect(page.getByRole('main').getByRole('link', { name: /100,00\s€/ })).toHaveCount(2);
});

test('card statements are imported from the bank export', async ({ page }) => {
	await login(page);
	const day = (d: string) => d.split('-').reverse().join('.');
	const header =
		'Bezeichnung Auftragskonto;IBAN Auftragskonto;BIC Auftragskonto;Bankname Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;BIC (SWIFT-Code) Zahlungsbeteiligter;Buchungstext;Verwendungszweck;Betrag;Waehrung;Saldo nach Buchung;Bemerkung;Kategorie;Gekennzeichneter Umsatz;Glaeubiger ID;Mandatsreferenz';
	const rows = [
		`Kreditkarte Muster;;;Musterbank eG;${day(addDays(today, -1))};${day(addDays(today, -1))};Bäckerei Beispiel;;;Kartenzahlung;Brötchen;-12,50;EUR;;;;;;`,
		`Kreditkarte Muster;;;Musterbank eG;${day(addDays(today, -2))};${day(addDays(today, -2))};Onlineshop Muster;;;Kartenzahlung;Bestellung 4711;-30,00;EUR;;;;;;`
	];
	const buffer = Buffer.from([header, ...rows].join('\r\n') + '\r\n', 'latin1');

	await openAccount(page, CARD);
	await page.getByRole('link', { name: 'CSV importieren' }).click();
	await page
		.getByLabel('CSV-Datei')
		.setInputFiles({ name: 'karte.csv', mimeType: 'text/csv', buffer });
	await page.getByRole('button', { name: 'Vorschau zeigen' }).click();
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Import übernommen' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Ergebnis' })).toContainText('2 neue Buchungen');

	await openAccount(page, CARD);
	await expect(balance(page)).toHaveText(/−192,50\s€/);
	await expect(
		page
			.getByRole('region', { name: 'Abrechnung' })
			.getByRole('listitem', { name: `Abrechnung ${formatDay(next)}` })
	).toContainText(/192,50\s€/);
});

test('a negative balance can be entered without a minus key', async ({ page }) => {
	// The phone's number pad has no minus: the +/− button sets the sign.
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByText('Kreditkarte', { exact: true }).click();
	await sheet.getByLabel('Name').fill('Minuskarte');
	const amount = sheet.getByLabel('Betrag in €');
	const sign = sheet.getByRole('button', { name: 'Vorzeichen wechseln' });
	await expect(amount).toHaveAttribute('inputmode', 'decimal');
	await amount.fill('250');
	await sign.click();
	await expect(amount).toHaveValue('-250');
	await expect(amount).toBeFocused();
	await sign.click();
	await expect(amount).toHaveValue('250');
	// Sign first, digits afterwards.
	await amount.fill('');
	await sign.click();
	await amount.pressSequentially('250,40');
	await expect(amount).toHaveValue('-250,40');
	await sheet.getByLabel('Stand am').fill(today);
	await sheet.getByLabel('Abbuchung von').selectOption({ label: GIRO });
	await sheet.getByLabel('Abrechnungstag (1–31)').fill(String(statementDay));
	await sheet.getByLabel('Abbuchungstag (1–31)').fill(String(debitDay));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await openAccount(page, 'Minuskarte');
	await expect(balance(page)).toHaveText(/−250,40\s€/);

	await page.getByRole('button', { name: 'Kontostand korrigieren' }).click();
	const adjust = page.getByRole('dialog', { name: 'Kontostand korrigieren' });
	await adjust.getByLabel('Tatsächlicher Stand in €').fill('300');
	await adjust.getByRole('button', { name: 'Vorzeichen wechseln' }).click();
	await adjust.getByRole('button', { name: 'Korrigieren' }).click();
	await expect(adjust).toBeHidden();
	await expect(balance(page)).toHaveText(/−300,00\s€/);
});

test('a card payment is recognised although its name carries the day of purchase', async ({
	page
}) => {
	await login(page);
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const create = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await create.getByLabel('Bezeichnung', { exact: true }).fill('Musikdienst Karte');
	await create.getByLabel('Betrag in €').fill('9,95');
	await create.getByLabel('Konto').selectOption({ label: CARD });
	await create.getByLabel('Erste Fälligkeit').fill(addDays(today, -2));
	await create.getByRole('button', { name: 'Anlegen' }).click();
	await expect(create).toBeHidden();

	// No IBAN, another amount, and the name ends with the day of purchase.
	const day = (d: string) => d.split('-').reverse().join('.');
	const bought = addDays(today, -1);
	const header =
		'Bezeichnung Auftragskonto;IBAN Auftragskonto;BIC Auftragskonto;Bankname Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;BIC (SWIFT-Code) Zahlungsbeteiligter;Buchungstext;Verwendungszweck;Betrag;Waehrung;Saldo nach Buchung;Bemerkung;Kategorie;Gekennzeichneter Umsatz;Glaeubiger ID;Mandatsreferenz';
	const row = `Kreditkarte Muster;;;Musterbank eG;${day(bought)};${day(bought)};MUSIKDIENST KARTE ${day(bought).slice(0, 6)};;;Kartenzahlung;Abo;-10,95;EUR;;;;;;`;
	const buffer = Buffer.from([header, row].join('\r\n') + '\r\n', 'latin1');

	await openAccount(page, CARD);
	await page.getByRole('link', { name: 'CSV importieren' }).click();
	await page
		.getByLabel('CSV-Datei')
		.setInputFiles({ name: 'karte-abo.csv', mimeType: 'text/csv', buffer });
	await page.getByRole('button', { name: 'Vorschau zeigen' }).click();
	await expect(
		page.getByText('Dauerposten „Musikdienst Karte“ (Name und Fälligkeit)')
	).toBeVisible();
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Import übernommen' })).toBeVisible();
});
