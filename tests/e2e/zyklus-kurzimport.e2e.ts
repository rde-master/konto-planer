import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// "Umsätze per Kurzbefehl importieren": the shortcut sends the bank export – booked at once or
// waiting for the preview. The file has no name and no ".csv"; the account is found by its IBAN.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Kurzkonto';
const IBAN = 'DE51123456780009990001';
const BAKER = 'Bäckerei Kurzweg';
const today = todayBerlin();

const HEADER =
	'Bezeichnung Auftragskonto;IBAN Auftragskonto;BIC Auftragskonto;Bankname Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;BIC (SWIFT-Code) Zahlungsbeteiligter;Buchungstext;Verwendungszweck;Betrag;Waehrung;Saldo nach Buchung;Bemerkung;Kategorie;Gekennzeichneter Umsatz;Glaeubiger ID;Mandatsreferenz';

const german = (day: string) => `${day.slice(8)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;

/** A bank export as the bank writes it: Windows-1252, newest row first. */
function exportFile(
	rows: [day: string, payee: string, amount: string, balance: string][],
	iban = IBAN
) {
	const lines = rows.map(
		([day, payee, amount, balance]) =>
			`Girokonto Kurz;${iban};GENODEF1XXX;Musterbank eG;${german(day)};${german(day)};${payee};;;Kartenzahlung;Einkauf ${payee};${amount};EUR;${balance};;;;;`
	);
	return Buffer.from([HEADER, ...lines].join('\r\n') + '\r\n', 'latin1');
}

const FIRST = exportFile([
	[addDays(today, -2), 'Kurzwaren Faden', '-30,00', '957,20'],
	[addDays(today, -3), BAKER, '-12,80', '987,20']
]);
const SECOND = exportFile([
	[addDays(today, -1), 'Kiosk Kurzpause', '-4,20', '953,00'],
	[addDays(today, -2), 'Kurzwaren Faden', '-30,00', '957,20'],
	[addDays(today, -3), BAKER, '-12,80', '987,20']
]);

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

const plain = (s: string) => s.replace(/\u00a0/g, ' ');

test('a shortcut imports the bank export: at once, or waiting for the preview', async ({
	page,
	playwright
}) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByLabel('Name').fill(ACCOUNT);
	await sheet.getByLabel('IBAN (optional)').fill(IBAN);
	await sheet.getByLabel('Betrag in €').fill('1.000');
	await sheet.getByLabel('Stand am').fill(addDays(today, -30));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	// The guide and both addresses are on the page; the access books elsewhere.
	await page.goto('/kurzbefehle');
	const guide = page.getByRole('region', { name: 'Anleitung: Umsätze importieren' });
	await expect(guide).toContainText('Base64-codieren');
	await expect(guide).toContainText('Im Share-Sheet anzeigen');
	const url = (await guide.getByTestId('import-url').textContent())!.trim();
	const previewUrl = (await guide.getByTestId('import-preview-url').textContent())!.trim();
	expect(url).toMatch(/\/api\/v1\/shortcut\/import$/);
	expect(previewUrl).toBe(`${url}?vorschau=1`);
	await page.getByLabel('Name').fill('Importhandy');
	await page.getByLabel('Bucht auf').selectOption({ label: 'Doppelkonto' });
	await page.getByRole('button', { name: 'Zugang anlegen' }).click();
	const header = (await page.getByTestId('shortcut-header').textContent())!.trim();
	const headers = { authorization: header };
	const api = await playwright.request.newContext();
	type Reply = { ok: boolean; message: string; url?: string };

	// Booked at once: Base64 in JSON, as the shortcut sends it. The account comes from the IBAN.
	let res = await api.post(url, { headers, data: { file: FIRST.toString('base64') } });
	expect(res.status()).toBe(200);
	let body = (await res.json()) as Reply;
	expect(plain(body.message)).toBe(`${ACCOUNT} importiert: 2 neu · Saldo stimmt: 957,20 €`);
	expect(body.url).toMatch(/\/konten\/[0-9a-f-]{36}\/import\/[0-9a-f-]{36}$/);
	// The umlaut survived the way (Windows-1252 bytes).
	await page.goto(`/buchungen?q=${encodeURIComponent(BAKER)}`);
	await expect(
		page.getByRole('main').getByRole('link', { name: new RegExp(`${BAKER}.*12,80`) })
	).toHaveCount(1);

	// The same file again: nothing is booked twice, no draft is left behind.
	res = await api.post(url, { headers, data: { file: FIRST.toString('base64') } });
	body = (await res.json()) as Reply;
	expect(body.message).toBe(`${ACCOUNT}: nichts Neues – alle 2 Buchungen sind schon vorhanden`);
	await page.goto('/');
	await expect(page.getByRole('region', { name: 'Import prüfen' })).toHaveCount(0);

	// A file of an account the app does not know is refused.
	res = await api.post(url, {
		headers,
		data: {
			file: exportFile([[today, 'Fremd', '-1,00', '1,00']], 'DE89370400440532013099').toString(
				'base64'
			)
		}
	});
	expect(res.status()).toBe(400);
	expect(((await res.json()) as Reply).message).toContain('gibt es kein Konto');

	// Preview only – here the file itself is the body, without a name.
	res = await api.post(previewUrl, {
		headers: { ...headers, 'content-type': 'text/csv' },
		data: SECOND
	});
	expect(res.status()).toBe(200);
	body = (await res.json()) as Reply;
	expect(body.message).toBe(
		`${ACCOUNT}: 1 neue Buchung wartet auf deine Prüfung in der App · 2 schon vorhanden`
	);
	await page.goto('/buchungen?q=Kurzpause');
	await expect(page.getByRole('main').getByRole('link', { name: /Kurzpause.*4,20/ })).toHaveCount(
		0
	);

	// It waits on the start page, and on the import page of the account.
	await page.goto(new URL(body.url!).pathname.replace(/\/[0-9a-f-]{36}$/, ''));
	await expect(
		page.getByRole('region', { name: 'Wartet auf Prüfung' }).getByRole('link')
	).toContainText('Vorschau öffnen');
	await page.goto('/');
	await page
		.getByRole('region', { name: 'Import prüfen' })
		.getByRole('link', { name: new RegExp(`${ACCOUNT}: Vorschau öffnen`) })
		.click();
	await expect(page).toHaveURL(new URL(body.url!).pathname);
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Import übernommen' })).toBeVisible();
	await page.goto('/buchungen?q=Kurzpause');
	await expect(page.getByRole('main').getByRole('link', { name: /Kurzpause.*4,20/ })).toHaveCount(
		1
	);
	await page.goto('/');
	await expect(page.getByRole('region', { name: 'Import prüfen' })).toHaveCount(0);

	// Without the access nothing is taken.
	res = await api.post(url, { data: { file: FIRST.toString('base64') } });
	expect(res.status()).toBe(401);
	await api.dispose();
});
