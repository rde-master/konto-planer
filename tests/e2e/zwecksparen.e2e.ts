import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Savings suggestion on payday. Runs last: other tests do not expect suggestion cards.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const GIRO = 'Gehaltskonto Vorschlag';
const OTHER = 'Zweitkonto Vorschlag';
const SAVINGS = 'Sparbuch Vorschlag';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function createAccount(page: Page, name: string, amount: string, savings = false) {
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	if (savings) await sheet.getByText('Sparbuch', { exact: true }).click();
	await sheet.getByLabel('Name').fill(name);
	await sheet.getByLabel('Betrag in €').fill(amount);
	await sheet.getByLabel('Stand am').fill(addDays(today, -15));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

async function createItem(
	page: Page,
	account: string,
	item: { name: string; amount: string; date: string; salary?: boolean }
) {
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	if (item.salary) await sheet.getByText('Einnahme', { exact: true }).click();
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill(item.name);
	await sheet.getByLabel('Betrag in €').fill(item.amount);
	await sheet.getByLabel('Konto').selectOption({ label: account });
	if (item.salary) await sheet.getByRole('switch', { name: /Gehalt/ }).check();
	await sheet.getByLabel('Erste Fälligkeit').fill(item.date);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

test('after the salary the free amount can go to the savings account', async ({ page }) => {
	await login(page);
	await createAccount(page, GIRO, '500');
	await createAccount(page, SAVINGS, '100', true);
	await page.goto('/sparziele');
	await page.getByRole('button', { name: 'Sparziel anlegen' }).click();
	const goal = page.getByRole('dialog', { name: 'Neues Sparziel' });
	await goal.getByLabel('Sparbuch').selectOption({ label: SAVINGS });
	await goal.getByLabel('Name').fill('Fahrrad Vorschlag');
	await goal.getByLabel('Zielbetrag in €').fill('1.000');
	await goal.getByRole('button', { name: 'Anlegen' }).click();
	await expect(goal).toBeHidden();

	// Salary 10 days ago (booked provisionally), rent before the next salary.
	await createItem(page, GIRO, {
		name: 'Gehalt Vorschlag',
		amount: '2.000',
		date: addDays(today, -10),
		salary: true
	});
	await createItem(page, GIRO, { name: 'Miete Vorschlag', amount: '700', date: addDays(today, 5) });

	await page.goto('/');
	const card = page.getByRole('region', { name: `Sparvorschlag ${GIRO}` });
	await expect(card).toContainText(/1\.800,00\s€ können aufs Sparbuch/);

	await card.getByLabel('Betrag in €').fill('2.000');
	await card.getByRole('button', { name: 'Umbuchen' }).click();
	await expect(card.getByText(/Höchstens 1\.800,00\s€/)).toBeVisible();

	await card.getByLabel('Betrag in €').fill('1.200');
	await card.getByLabel('Sparbuch').selectOption({ label: SAVINGS });
	await card.getByLabel('Sparziel').selectOption({ label: 'Fahrrad Vorschlag' });
	await card.getByRole('button', { name: 'Umbuchen' }).click();
	await expect(page.getByRole('status')).toHaveText(
		/1\.200,00\s€ auf Sparbuch Vorschlag umgebucht und „Fahrrad Vorschlag“ zugeteilt\./
	);
	await expect(card).toBeHidden();

	// Two linked bookings; the goal is full (capped at its target).
	await page.goto('/buchungen?q=Sparen%20am%20Gehaltstag');
	const rows = page.getByRole('main').getByRole('link', { name: /1\.200,00\s€/ });
	await expect(rows).toHaveCount(2);
	await page.goto('/sparziele');
	await expect(page.getByRole('main')).toContainText(/1\.000,00\s€/);
});

test('a suggestion can be dismissed', async ({ page }) => {
	await login(page);
	await createAccount(page, OTHER, '300');
	await createItem(page, OTHER, {
		name: 'Nebenjob Vorschlag',
		amount: '400',
		date: addDays(today, -10),
		salary: true
	});
	await page.goto('/');
	const card = page.getByRole('region', { name: `Sparvorschlag ${OTHER}` });
	await expect(card).toContainText(/700,00\s€ können aufs Sparbuch/);
	await card.getByRole('button', { name: 'Nicht jetzt' }).click();
	await expect(page.getByRole('status')).toHaveText('Sparvorschlag ausgeblendet.');
	await expect(card).toBeHidden();
	await page.reload();
	await expect(card).toBeHidden();
});
