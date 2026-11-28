import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { formatDay, todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';
import { isBankDay } from '../../src/lib/bank-calendar';

// A savings account takes the bank's export too: its rows replace what the app booked there
// itself – the counter booking of a transfer, the provisional booking of a standing order and
// the computed interest.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const GIRO = 'Sparquelle';
const GIRO_IBAN = 'DE72123456780009990011';
const SAVINGS = 'Importsparbuch';
const SAVINGS_IBAN = 'DE45123456780009990012';
const today = todayBerlin();
const lastYear = Number(today.slice(0, 4)) - 1;
const opening = `${lastYear}-01-01`;
const yearEnd = `${lastYear}-12-31`;
const paid = addDays(today, -3);
const ORDER = 'Importsparrate';
const orderPaid = addDays(today, -2);

const HEADER =
	'Bezeichnung Auftragskonto;IBAN Auftragskonto;BIC Auftragskonto;Bankname Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;BIC (SWIFT-Code) Zahlungsbeteiligter;Buchungstext;Verwendungszweck;Betrag;Waehrung;Saldo nach Buchung;Bemerkung;Kategorie;Gekennzeichneter Umsatz;Glaeubiger ID;Mandatsreferenz';

const german = (day: string) => `${day.slice(8)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;

type Row = {
	day: string;
	payee?: string;
	payeeIban?: string;
	text: string;
	purpose: string;
	amount: string;
	balance: string;
};

/** A bank export as the bank writes it: Windows-1252, newest row first. */
function exportFile(iban: string, rows: Row[]) {
	const lines = rows.map(
		(r) =>
			`Konto;${iban};GENODEF1XXX;Musterbank eG;${german(r.day)};${german(r.day)};${r.payee ?? ''};${r.payeeIban ?? ''};;${r.text};${r.purpose};${r.amount};EUR;${r.balance};;;;;`
	);
	return Buffer.from([HEADER, ...lines].join('\r\n') + '\r\n', 'latin1');
}

// A transfer by hand and the standing order as the giro account sees them …
const GIRO_FILE = exportFile(GIRO_IBAN, [
	{
		day: orderPaid,
		payee: 'Erika Muster',
		payeeIban: SAVINGS_IBAN,
		text: 'Dauerauftrag',
		purpose: ORDER,
		amount: '-50,00',
		balance: '1.850,00'
	},
	{
		day: paid,
		payee: 'Erika Muster',
		payeeIban: SAVINGS_IBAN,
		text: 'Überweisung',
		purpose: 'Sparrate',
		amount: '-100,00',
		balance: '1.900,00'
	}
]);
// … and the savings account: the same two, and last year's interest (the bank pays 19,50 €
// where the app computed 20,00 €, booked on the day before the year ended).
const SAVINGS_ROWS: Row[] = [
	{
		day: orderPaid,
		payee: 'Erika Muster',
		payeeIban: GIRO_IBAN,
		text: 'Gutschrift',
		purpose: ORDER,
		amount: '50,00',
		balance: '1.169,50'
	},
	{
		day: paid,
		payee: 'Erika Muster',
		payeeIban: GIRO_IBAN,
		text: 'Gutschrift',
		purpose: 'Sparrate',
		amount: '100,00',
		balance: '1.119,50'
	},
	{
		day: `${lastYear}-12-30`,
		text: 'Abschluss',
		purpose: `Abschluss per 31.12.${lastYear} Habenzinsen`,
		amount: '19,50',
		balance: '1.019,50'
	}
];
const SAVINGS_FILE = exportFile(SAVINGS_IBAN, SAVINGS_ROWS);
const GOAL = 'Importreparatur';

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

const plain = (s: string) => s.replace(/\u00a0/g, ' ');

/** Opens the account's page and returns its id. */
async function openAccount(page: Page, name: string) {
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(name) }).click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
	return new URL(page.url()).pathname.split('/').at(-1)!;
}

/** Bookings of the savings account in the list, by amount. */
function booking(page: Page, amount: RegExp) {
	return page.getByRole('main').getByRole('link', { name: amount });
}

test('a shortcut imports the export of a savings account', async ({ page, playwright }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	let sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByLabel('Name').fill(GIRO);
	await sheet.getByLabel('IBAN (optional)').fill(GIRO_IBAN);
	await sheet.getByLabel('Betrag in €').fill('2.000');
	await sheet.getByLabel('Stand am').fill(addDays(today, -30));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByText('Sparbuch', { exact: true }).click();
	await sheet.getByLabel('Name').fill(SAVINGS);
	await sheet.getByLabel('IBAN (optional)').fill(SAVINGS_IBAN);
	await sheet.getByLabel('Betrag in €').fill('1.000');
	await sheet.getByLabel('Stand am').fill(opening);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	// 2 % for all of last year: the app books 20,00 € on 31 December.
	await page.getByRole('link', { name: new RegExp(SAVINGS) }).click();
	await expect(page.getByRole('heading', { level: 1, name: SAVINGS })).toBeVisible();
	const savingsPath = new URL(page.url()).pathname;
	const savingsId = savingsPath.split('/').at(-1)!;
	await openTab(page, 'Zinsen');
	await page.getByRole('button', { name: 'Zinssatz ändern' }).click();
	const rate = page.getByRole('dialog', { name: 'Zinssatz ändern' });
	await rate.getByLabel('Zinssatz in % p. a.').fill('2');
	await rate.getByLabel('Gültig ab').fill(opening);
	await rate.getByRole('button', { name: 'Sichern' }).click();
	await expect(rate).toBeHidden();
	// The import is offered on a savings account as well.
	await openTab(page, 'Übersicht');
	await expect(page.getByRole('link', { name: 'CSV importieren' })).toBeVisible();
	const list = `/buchungen?konto=${savingsId}`;
	await page.goto(list);
	await expect(booking(page, /Zinsen.*\+20,00/)).toHaveCount(1);

	// A standing order to the savings account, due some days ago: provisional on both sides.
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const order = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await order.getByText('Umbuchung', { exact: true }).click();
	await order.getByLabel('Bezeichnung', { exact: true }).fill(ORDER);
	await order.getByLabel('Betrag in €').fill('50');
	await order.getByLabel('Von Konto').selectOption({ label: GIRO });
	await order.getByLabel('Auf Konto').selectOption({ label: SAVINGS });
	await order.getByLabel('Erste Fälligkeit').fill(addDays(today, -5));
	await order.getByRole('button', { name: 'Anlegen' }).click();
	await expect(order).toBeHidden();
	await page.goto(list);
	await expect(booking(page, /vorläufig.*\+50,00|\+50,00.*vorläufig/)).toHaveCount(1);

	await page.goto('/kurzbefehle');
	const guide = page.getByRole('region', { name: 'Anleitung: Umsätze importieren' });
	const url = (await guide.getByTestId('import-url').textContent())!.trim();
	await page.getByLabel('Name').fill('Sparhandy');
	await page.getByLabel('Bucht auf').selectOption({ label: GIRO });
	await page.getByRole('button', { name: 'Zugang anlegen' }).click();
	const headers = {
		authorization: (await page.getByTestId('shortcut-header').textContent())!.trim()
	};
	const api = await playwright.request.newContext();
	type Reply = { ok: boolean; message: string; url?: string };

	// The giro account's file: the transfer gets its counter booking on the savings account.
	let res = await api.post(url, { headers, data: { file: GIRO_FILE.toString('base64') } });
	expect(res.status()).toBe(200);
	let body = (await res.json()) as Reply;
	expect(plain(body.message)).toBe(
		`${GIRO} importiert: 1 neu · 1 ersetzt · Saldo stimmt: 1.850,00 €`
	);
	// The standing order is booked on the giro account; here its side still waits for the bank.
	await page.goto(list);
	await expect(booking(page, /\+100,00/)).toHaveCount(1);
	await expect(booking(page, /vorläufig.*\+50,00|\+50,00.*vorläufig/)).toHaveCount(1);

	// The savings account's own file is found by its IBAN – first only for the preview.
	res = await api.post(`${url}?vorschau=1`, {
		headers,
		data: { file: SAVINGS_FILE.toString('base64') }
	});
	expect(res.status()).toBe(200);
	body = (await res.json()) as Reply;
	expect(body.message).toBe(`${SAVINGS}: 3 neue Buchungen warten auf deine Prüfung in der App`);
	await page.goto(new URL(body.url!).pathname);
	const main = page.getByRole('main');
	await expect(main).toContainText(
		new RegExp(`Zinsen bis ${formatDay(yearEnd)}, ersetzt berechnete 20,00\\s€`)
	);
	await expect(main).toContainText('Gegenbuchung aus anderem Import');
	await expect(main).toContainText(`Dauerposten „${ORDER}“ (IBAN)`);
	await expect(main.getByLabel('Neu', { exact: true })).toHaveText('0 neu');
	await expect(main.getByLabel('Dauerposten', { exact: true })).toHaveText('1 zu Dauerposten');
	await expect(main.getByLabel('Ersetzt', { exact: true })).toHaveText('2 ersetzen eine Buchung');
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Import übernommen' })).toBeVisible();
	await expect(main).toContainText(/Differenz\s*stimmt/);

	// Nothing is there twice: each transfer once and real, the bank's interest instead of the
	// computed.
	await page.goto(list);
	await expect(booking(page, /\+100,00/)).toHaveCount(1);
	await expect(booking(page, /\+50,00/)).toHaveCount(1);
	await expect(booking(page, /vorläufig/)).toHaveCount(0);
	await expect(booking(page, /\+20,00/)).toHaveCount(0);
	await booking(page, /\+19,50/).click();
	await expect(main).toContainText('Betrag der Bank aus dem Import');
	await expect(main).toContainText(new RegExp(`Periode bis\\s*${formatDay(yearEnd)}`));
	await expect(main).toContainText('Zinsen (Import)');
	await expect(page.getByRole('button', { name: 'Betrag anpassen' })).toHaveCount(0);
	await page.goto(savingsPath);
	await expect(main).toContainText(/1\.169,50\s€/);

	// The same file again, booked at once: all of it is known.
	res = await api.post(url, { headers, data: { file: SAVINGS_FILE.toString('base64') } });
	body = (await res.json()) as Reply;
	expect(body.message).toBe(`${SAVINGS}: nichts Neues – alle 3 Buchungen sind schon vorhanden`);
	await api.dispose();
});

test('undoing the import brings the app’s own bookings back', async ({ page }) => {
	await login(page);
	const savingsId = await openAccount(page, SAVINGS);
	await page.getByRole('link', { name: 'CSV importieren' }).click();
	await page.getByRole('button', { name: 'Letzten Import rückgängig machen' }).click();
	await page
		.getByRole('dialog', { name: 'Import rückgängig' })
		.getByRole('button', { name: 'Rückgängig machen' })
		.click();
	await expect(page.getByRole('status')).toHaveText('Import zurückgenommen.');

	await page.goto(`/buchungen?konto=${savingsId}`);
	await expect(booking(page, /\+100,00/)).toHaveCount(1);
	await expect(booking(page, /\+19,50/)).toHaveCount(0);
	await expect(booking(page, /vorläufig.*\+50,00|\+50,00.*vorläufig/)).toHaveCount(1);
	await booking(page, /Zinsen.*\+20,00/).click();
	await expect(page.getByRole('main')).toContainText('Berechnet aus Stand und Zinssatz');
});

test('the bank’s rows replace the transfer of a savings goal on both accounts', async ({
	page,
	playwright
}) => {
	// A payment due today needs a bank day.
	test.skip(!isBankDay(today), 'Heute ist kein Bankarbeitstag.');
	await login(page);
	const savingsId = await openAccount(page, SAVINGS);
	const giroId = await openAccount(page, GIRO);

	// A payment due today with a goal that has all of it: the app transfers 150 € to the giro.
	await page.goto('/geplant');
	await page.getByRole('button', { name: 'Zahlung planen' }).click();
	const plan = page.getByRole('dialog', { name: 'Zahlung planen' });
	await plan.getByLabel('Bezeichnung', { exact: true }).fill(GOAL);
	await plan.getByLabel('Betrag in €').fill('150');
	await plan.getByLabel('Datum').fill(today);
	await plan.getByLabel('Konto').selectOption({ label: GIRO });
	await plan.getByRole('button', { name: 'Planen' }).click();
	await expect(plan).toBeHidden();
	await page.goto('/sparziele');
	await page.getByRole('button', { name: 'Sparziel anlegen' }).click();
	const goal = page.getByRole('dialog', { name: 'Neues Sparziel' });
	await goal.getByLabel('Sparbuch').selectOption({ label: SAVINGS });
	await goal.getByLabel('Name').fill(GOAL);
	await goal
		.getByLabel('Für Zahlung')
		.selectOption({ label: `${GOAL} · ${GIRO} · ${formatDay(today)}` });
	await goal.getByLabel('Schon zurückgelegt in €').fill('150');
	await goal.getByRole('button', { name: 'Anlegen' }).click();
	await expect(goal).toBeHidden();
	await page.goto(`/buchungen?konto=${savingsId}`);
	await expect(booking(page, /Sparziel „Importreparatur“.*150,00/)).toHaveCount(1);

	await page.goto('/kurzbefehle');
	const url = (await page
		.getByRole('region', { name: 'Anleitung: Umsätze importieren' })
		.getByTestId('import-url')
		.textContent())!.trim();
	await page.getByLabel('Name').fill('Zielhandy');
	await page.getByLabel('Bucht auf').selectOption({ label: GIRO });
	await page.getByRole('button', { name: 'Zugang anlegen' }).click();
	const headers = {
		authorization: (await page.getByTestId('shortcut-header').textContent())!.trim()
	};
	const api = await playwright.request.newContext();
	type Reply = { ok: boolean; message: string };

	// The savings account's file with the real transfer: it takes the place of the app's.
	const transfer = {
		day: today,
		payee: 'Erika Muster',
		text: 'Überweisung',
		purpose: 'Reparatur',
		amount: '-150,00',
		balance: '1.019,50'
	};
	let res = await api.post(url, {
		headers,
		data: {
			file: exportFile(SAVINGS_IBAN, [
				{ ...transfer, payeeIban: GIRO_IBAN },
				...SAVINGS_ROWS
			]).toString('base64')
		}
	});
	expect(res.status()).toBe(200);
	expect(plain(((await res.json()) as Reply).message)).toBe(
		`${SAVINGS} importiert: 0 neu · 4 ersetzt · Saldo stimmt: 1.019,50 €`
	);
	await page.goto(`/buchungen?konto=${savingsId}`);
	await expect(booking(page, /150,00/)).toHaveCount(1);
	await booking(page, /150,00/).click();
	// Still the goal's transfer, now with the bank's row.
	await expect(page.getByRole('region', { name: 'Sparziel' })).toContainText(GOAL);
	await expect(page.getByRole('main')).toContainText('Import');

	// The giro account's file brings the other side.
	res = await api.post(url, {
		headers,
		data: {
			file: exportFile(GIRO_IBAN, [
				{ ...transfer, payeeIban: SAVINGS_IBAN, amount: '150,00', balance: '2.000,00' }
			]).toString('base64')
		}
	});
	expect(res.status()).toBe(200);
	expect(((await res.json()) as Reply).message).toContain('0 neu · 1 ersetzt');
	await page.goto(`/buchungen?konto=${giroId}`);
	await expect(booking(page, /\+150,00/)).toHaveCount(1);
	await booking(page, /\+150,00/).click();
	await expect(page.getByRole('region', { name: 'Sparziel' })).toContainText(GOAL);
	await page.goto('/sparziele');
	await page.getByRole('link', { name: new RegExp(`^${GOAL}`) }).click();
	await expect(page.getByRole('region', { name: 'Umbuchungen' })).toContainText('umgebucht');
	await api.dispose();
});
