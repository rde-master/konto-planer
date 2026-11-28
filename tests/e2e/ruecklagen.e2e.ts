import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addMonths } from '../../src/lib/recurring';

// Own giro and savings account; a yearly expense paid half a year ago.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const GIRO = 'Versicherungskonto';
const SAVINGS = 'Rücklagensparbuch';
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
	await sheet.getByLabel('Stand am').fill(addMonths(today, -12));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

async function createItem(page: Page, name: string, amount: string, interval: string) {
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill(name);
	await sheet.getByLabel('Betrag in €').fill(amount);
	await sheet.getByLabel('Konto').selectOption({ label: GIRO });
	await sheet.getByLabel('Intervall').selectOption({ label: interval });
	await sheet.getByLabel('Erste Fälligkeit').fill(addMonths(today, -6));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

test('yearly payments become a monthly reserve', async ({ page }) => {
	await login(page);
	await createAccount(page, GIRO, '2.000');
	await createAccount(page, SAVINGS, '1.000', true);
	await createItem(page, 'Kfz-Versicherung', '600', 'Jährlich');
	await createItem(page, 'Mobilfunk', '20', 'Monatlich');

	await page.goto('/ruecklagen');
	const row = page.getByRole('listitem', { name: 'Kfz-Versicherung' });
	await expect(row).toContainText(/50,00\s€/);
	await expect(page.getByRole('listitem', { name: 'Mobilfunk' })).toHaveCount(0);

	await page.goto('/dauerposten');
	await page.getByRole('link', { name: /^Kfz-Versicherung/ }).click();
	await expect(page.getByRole('region', { name: 'Rücklage' })).toContainText(/50,00\s€/);
});

test('a reserve becomes a savings goal with a monthly transfer', async ({ page }) => {
	await login(page);
	await page.goto('/dauerposten');
	await page.getByRole('link', { name: /^Kfz-Versicherung/ }).click();
	await page.getByRole('link', { name: 'Als Sparziel anlegen' }).click();

	const sheet = page.getByRole('dialog', { name: 'Als Sparziel anlegen' });
	await expect(sheet).toBeVisible();
	// Half the year has passed: about half the amount is suggested.
	await expect(sheet.getByLabel('Schon zurückgelegt in €')).toHaveValue(/^(29\d|30\d),\d\d$/);
	await sheet.getByLabel('Sparbuch', { exact: true }).selectOption({ label: SAVINGS });
	await sheet.getByLabel('Schon zurückgelegt in €').fill('1.500');
	await sheet.getByRole('switch', { name: /Monatliche Umbuchung/ }).check();
	await sheet.getByLabel('Von Girokonto').selectOption({ label: GIRO });
	await expect(sheet.getByLabel('Betrag im Monat in €')).toHaveValue('50,00');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet.getByText('Höchstens der Zielbetrag.')).toBeVisible();
	await sheet.getByLabel('Schon zurückgelegt in €').fill('300');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Sparziel „Kfz-Versicherung“ angelegt.');

	const row = page.getByRole('listitem', { name: 'Kfz-Versicherung' });
	await expect(row.getByRole('link', { name: 'Sparziel Kfz-Versicherung' })).toContainText(
		/300,00\s€ \/ 600,00\s€/
	);
	await expect(page.getByRole('region', { name: 'Summe' })).toContainText(
		/davon 50,00\s€ mit Sparziel/
	);

	await page.goto('/dauerposten');
	await expect(page.getByRole('link', { name: /Rücklage Kfz-Versicherung/ }).first()).toBeVisible();

	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(SAVINGS) }).click();
	await expect(page.getByLabel('Rücklagen im Monat')).toHaveText(/50,00\s€/);
	await expect(
		page.getByRole('region', { name: 'Sparziele' }).getByRole('link', { name: /Kfz/ })
	).toBeVisible();
});
