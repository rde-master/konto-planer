import { expect, test, type Page } from '@playwright/test';
import { formatDay, todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';
import { isBankDay, nextBankDay } from '../../src/lib/bank-calendar';

// Own giro account and savings account, so the numbers do not depend on other tests.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const GIRO = 'Reisekonto';
const SAVINGS = 'Reisesparbuch';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort').fill(ADMIN.password);
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
	await sheet.getByLabel('Stand am').fill(today);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

async function openAccount(page: Page, name: string) {
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(name) }).click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

async function planPayment(page: Page, name: string, amount: string, date: string) {
	await page.goto('/geplant');
	await page.getByRole('button', { name: 'Zahlung planen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Zahlung planen' });
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill(name);
	await sheet.getByLabel('Betrag in €').fill(amount);
	await sheet.getByLabel('Datum').fill(date);
	await sheet.getByLabel('Konto').selectOption({ label: GIRO });
	await sheet.getByRole('button', { name: 'Planen' }).click();
	await expect(sheet).toBeHidden();
}

async function createGoal(
	page: Page,
	name: string,
	payment: string,
	date: string,
	allocated: string
) {
	await page.goto('/sparziele');
	await page.getByRole('button', { name: 'Sparziel anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Sparziel' });
	await sheet.getByLabel('Sparbuch').selectOption({ label: SAVINGS });
	await sheet.getByLabel('Name').fill(name);
	await sheet
		.getByLabel('Für Zahlung')
		.selectOption({ label: `${payment} · ${GIRO} · ${formatDay(nextBankDay(date))}` });
	await sheet.getByLabel('Schon zurückgelegt in €').fill(allocated);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	return sheet;
}

const available = (page: Page) => page.getByLabel('Verfügbar', { exact: true });
const minimum = (page: Page) => page.getByLabel('Mindestbestand', { exact: true });

test('a goal linked to a payment relieves the minimum balance', async ({ page }) => {
	await login(page);
	await createAccount(page, GIRO, '100');
	await createAccount(page, SAVINGS, '2.000', true);
	await planPayment(page, 'Reise', '1.200', addDays(today, 10));

	// Fixed cut-off after the payment.
	await openAccount(page, GIRO);
	await page.getByRole('button', { name: /Stichtag/ }).click();
	const cutoff = page.getByRole('dialog', { name: 'Stichtag' });
	await cutoff.getByLabel('Rechnen bis').selectOption({ label: 'Festes Datum' });
	await cutoff.getByLabel('Datum').fill(addDays(today, 20));
	await cutoff.getByRole('button', { name: 'Sichern' }).click();
	await expect(cutoff).toBeHidden();
	await expect(minimum(page)).toHaveText(/1\.200,00\s€/);

	const sheet = await createGoal(page, 'Reise', 'Reise', addDays(today, 10), '3.000');
	await expect(sheet.getByText('Höchstens der Zielbetrag.')).toBeVisible();
	await sheet.getByLabel('Schon zurückgelegt in €').fill('800');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Sparziel „Reise“ angelegt.');
	// With a space: the back button may name the account "Reisekonto".
	const row = page.getByRole('link', { name: /^Reise / });
	await expect(row).toContainText(/800,00\s€ \/ 1\.200,00\s€/);
	await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');

	// 100 € + 800 € from the savings account − 1.200 € = −300 €: 400 € are needed.
	await openAccount(page, GIRO);
	await expect(minimum(page)).toHaveText(/400,00\s€/);
	await expect(available(page)).toHaveText(/−300,00\s€/);
	await expect(page.getByRole('region', { name: 'Bis zum Stichtag fällig' })).toContainText(
		'Sparziel „Reise“'
	);
});

test('setting aside the full amount; the savings account shows what is free', async ({ page }) => {
	await login(page);
	await page.goto('/sparziele');
	await page.getByRole('link', { name: /^Reise / }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Reise' })).toBeVisible();
	await expect(page.getByLabel('Fehlt noch')).toHaveText(/400,00\s€/);
	await expect(page.getByLabel('Zieldatum')).toHaveText(formatDay(nextBankDay(addDays(today, 10))));
	await expect(page.getByLabel('Sparrate')).toContainText('im Monat');

	await page.getByRole('button', { name: 'Zurücklegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Zurücklegen' });
	await sheet.getByLabel('Zurückgelegt in €').fill('2.500');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet.getByText('Höchstens der Zielbetrag.')).toBeVisible();
	await sheet.getByLabel('Zurückgelegt in €').fill('1.200');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByLabel('Zurückgelegt', { exact: true })).toHaveText(/1\.200,00\s€/);
	await expect(page.getByLabel('Sparrate')).toHaveText('Ziel erreicht');

	await openAccount(page, GIRO);
	await expect(minimum(page)).toHaveText(/^0,00\s€$/);
	await expect(available(page)).toHaveText(/^100,00\s€$/);

	await openAccount(page, SAVINGS);
	const goals = page.getByRole('region', { name: 'Sparziele' });
	await expect(goals.getByRole('link', { name: /^Reise/ })).toBeVisible();
	await expect(goals.getByLabel('Frei für Sparziele')).toHaveText(/800,00\s€/);
});

test('on the payment day the set-aside amount is transferred; it can be taken back', async ({
	page
}) => {
	// A payment due today needs a bank day.
	test.skip(!isBankDay(today), 'Heute ist kein Bankarbeitstag.');
	await login(page);
	await planPayment(page, 'Reparatur', '150', today);
	const sheet = await createGoal(page, 'Reparatur', 'Reparatur', today, '100');
	await expect(sheet).toBeHidden();
	await page.getByRole('link', { name: /^Reparatur/ }).click();
	await expect(page.locator('main').getByText('Erledigt', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Zurückgelegt', { exact: true })).toHaveText(/0,00\s€/);
	const transfers = page.getByRole('region', { name: 'Umbuchungen' });
	await expect(transfers).toContainText('umgebucht');
	await expect(transfers).toContainText(/100,00\s€/);

	await page.goto('/buchungen');
	const booking = page.getByRole('link', { name: /Sparziel „Reparatur“/ });
	await expect(booking).toHaveCount(2);
	await booking.filter({ hasText: '+' }).click();
	await expect(page.getByRole('region', { name: 'Sparziel' })).toContainText('Reparatur');
	await page.getByRole('button', { name: 'Umbuchung zurücknehmen' }).click();
	await page
		.getByRole('dialog', { name: 'Umbuchung zurücknehmen' })
		.getByRole('button', { name: 'Zurücknehmen' })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Reparatur' })).toBeVisible();
	await expect(page.getByLabel('Zurückgelegt', { exact: true })).toHaveText(/100,00\s€/);
	await expect(page.getByRole('region', { name: 'Umbuchungen' })).toContainText('zurückgenommen');
});

test('deleting a goal; changes are logged', async ({ page }) => {
	await login(page);
	await page.goto('/sparziele');
	await page.getByRole('link', { name: /^Reise / }).click();
	await page.getByRole('button', { name: 'Sparziel löschen' }).click();
	await page
		.getByRole('dialog', { name: 'Sparziel löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: SAVINGS })).toBeVisible();

	await page.goto('/einstellungen/protokoll?bereich=goal');
	await expect(
		page.getByRole('button').filter({ hasText: 'Sparziel angelegt' }).first()
	).toBeVisible();
	await expect(
		page.getByRole('button').filter({ hasText: 'Sparziel gelöscht' }).first()
	).toBeVisible();
	await expect(
		page.getByRole('button').filter({ hasText: 'Sparziel-Betrag zugeteilt' }).first()
	).toBeVisible();
});
