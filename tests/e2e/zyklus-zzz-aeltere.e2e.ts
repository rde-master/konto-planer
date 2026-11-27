import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// "Ältere Buchungen anzeigen" keeps the place in the list. Runs last ("zzz"): it fills an
// account with more bookings than one page shows.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Vielkonto';
const IBAN = 'DE24123456780009990002';
const today = todayBerlin();
const german = (day: string) => `${day.slice(8)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;

/** 120 payments, four a day, as a bank export. */
function manyRows() {
	const header = 'IBAN Auftragskonto;Buchungstag;Name Zahlungsbeteiligter;Verwendungszweck;Betrag';
	const lines = Array.from({ length: 120 }, (_, i) => {
		const day = german(addDays(today, -1 - Math.floor(i / 4)));
		return `${IBAN};${day};Vielmarkt;Einkauf Bon ${String(i + 1).padStart(2, '0')};-${i + 1},00`;
	});
	return Buffer.from([header, ...lines].join('\r\n') + '\r\n', 'latin1');
}

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('loading older bookings keeps the place in the list', async ({ page, playwright }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByLabel('Name').fill(ACCOUNT);
	await sheet.getByLabel('IBAN (optional)').fill(IBAN);
	await sheet.getByLabel('Betrag in €').fill('9.000');
	await sheet.getByLabel('Stand am').fill(addDays(today, -40));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	// The quickest way to many bookings: the import by shortcut.
	await page.goto('/kurzbefehle');
	await page.getByLabel('Name').fill('Vielhandy');
	await page.getByLabel('Bucht auf').selectOption({ label: ACCOUNT });
	await page.getByRole('button', { name: 'Zugang anlegen' }).click();
	const header = (await page.getByTestId('shortcut-header').textContent())!.trim();
	const url = (await page.getByTestId('import-url').textContent())!.trim();
	const api = await playwright.request.newContext();
	const res = await api.post(url, {
		headers: { authorization: header },
		data: { file: manyRows().toString('base64') }
	});
	const body = (await res.json()) as { message: string; url: string };
	expect(body.message).toContain('120 neu');
	await api.dispose();
	const accountId = /konten\/([0-9a-f-]{36})\//.exec(body.url)![1];

	await page.goto(`/buchungen?konto=${accountId}`);
	const rows = page.getByRole('main').getByRole('link', { name: /Vielmarkt/ });
	await expect(rows).toHaveCount(100);
	const more = page.getByRole('link', { name: 'Ältere Buchungen anzeigen' });
	await more.scrollIntoViewIfNeeded();
	const before = await page.evaluate(() => window.scrollY);
	expect(before).toBeGreaterThan(1000);
	await more.click();
	await expect(rows).toHaveCount(120);
	// Still where the reader was: the older bookings follow below.
	expect(await page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(before - 50);
	await expect(more).toHaveCount(0);
});
