import { expect, test, type Page } from '@playwright/test';
import { formatDay, todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';
import { monthLabel } from '../../src/lib/tags';

// Evaluations on an own account: categories, income/expenses, fixed costs, calendar.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Statistikkonto';
const today = todayBerlin();
const monthStart = `${today.slice(0, 7)}-01`;

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function book(
	page: Page,
	payee: string,
	amount: string,
	opts: { income?: boolean; category?: string } = {}
) {
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	if (opts.income) await sheet.getByText('Einnahme', { exact: true }).click();
	await sheet.getByLabel('Betrag in €').fill(amount);
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	if (opts.category) await sheet.getByLabel('Kategorie').selectOption({ label: opts.category });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(payee);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
}

async function item(page: Page, name: string, amount: string, interval: string) {
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await sheet.getByLabel('Bezeichnung').fill(name);
	await sheet.getByLabel('Betrag in €').fill(amount);
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Intervall').selectOption({ label: interval });
	await sheet.getByLabel('Erste Fälligkeit').fill(monthStart);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

async function open(page: Page, view: string) {
	await page.goto('/auswertungen');
	await page.locator('main').getByLabel('Konten').selectOption({ label: ACCOUNT });
	await expect(page).toHaveURL(/konto=/);
	await page.getByRole('navigation', { name: 'Ansicht' }).getByRole('link', { name: view }).click();
}

test('expenses by category, income and expenses', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('1.000');
	await account.getByLabel('Stand am').fill(addDays(monthStart, -40));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/buchungen');
	await book(page, 'Supermarkt Statistik', '30', { category: 'Supermarkt' });
	await book(page, 'Gehalt Statistik', '1.000', { income: true });
	await item(page, 'Miete Statistik', '500', 'Monatlich');
	await item(page, 'Versicherung Statistik', '120', 'Jährlich');

	await open(page, 'Kategorien');
	const food = page.getByRole('listitem', { name: 'Lebensmittel' });
	await expect(food).toContainText(/30,00\s€/);
	await expect(food).toContainText('Supermarkt');

	await open(page, 'Ein/Aus');
	await expect(page.getByRole('img', { name: 'Einnahmen und Ausgaben je Monat' })).toBeVisible();
	await expect(
		page.getByRole('list', { name: 'Monate' }).getByRole('listitem').first()
	).toContainText(/\+1\.000,00\s€/);
});

test('fixed costs per month and the price list', async ({ page }) => {
	await login(page);
	await open(page, 'Fixkosten');
	// 500 € monthly + 120 € yearly / 12.
	await expect(page.getByLabel('Fixkosten im Monat')).toHaveText(/510,00\s€/);
	await expect(page.getByRole('img', { name: 'Fixkosten je Monat' })).toBeVisible();

	await open(page, 'Preise');
	await expect(page.getByText('Noch keine Preisänderungen bei Dauerposten.')).toBeVisible();
});

test('the calendar shows months and a day heat map', async ({ page }) => {
	await login(page);
	await open(page, 'Kalender');
	const tile = page.getByRole('link', { name: new RegExp(`^${monthLabel(today.slice(0, 7))}:`) });
	await expect(tile).toContainText('Miete Statistik');
	await tile.click();
	await expect(page).toHaveURL(/monat=/);
	const days = page.getByRole('region', { name: `Tage im ${monthLabel(today.slice(0, 7))}` });
	await days.getByRole('button', { name: new RegExp(`^${formatDay(today)}:`) }).click();
	await expect(page.getByRole('list', { name: `Ausgaben am ${formatDay(today)}` })).toContainText(
		'Supermarkt Statistik'
	);
});
