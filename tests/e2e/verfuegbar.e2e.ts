import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { formatDay, todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';
import { nextBankDay } from '../../src/lib/bank-calendar';

// Own account, so the numbers do not depend on other tests. All due dates lie after today.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Stichtagkonto';
const today = todayBerlin();
const salaryDay = nextBankDay(addDays(today, 20));

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openAccount(page: Page) {
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await expect(page.getByRole('heading', { level: 1, name: ACCOUNT })).toBeVisible();
}

async function createItem(
	page: Page,
	item: { name: string; amount: string; date: string; income?: boolean; once?: boolean }
) {
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	if (item.income) await sheet.getByText('Einnahme', { exact: true }).click();
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill(item.name);
	await sheet.getByLabel('Betrag in €').fill(item.amount);
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	if (item.income) await sheet.getByRole('switch', { name: /Gehalt/ }).check();
	if (item.once) {
		await sheet.getByLabel('Intervall').selectOption({ label: 'Einmalig' });
		await sheet.getByLabel('Datum').fill(item.date);
	} else await sheet.getByLabel('Erste Fälligkeit').fill(item.date);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

async function planPayment(
	page: Page,
	item: { name: string; amount: string; date: string; income?: boolean }
) {
	await page.goto('/geplant');
	await page.getByRole('button', { name: 'Zahlung planen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Zahlung planen' });
	if (item.income) await sheet.getByText('Einnahme', { exact: true }).click();
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill(item.name);
	await sheet.getByLabel('Betrag in €').fill(item.amount);
	await sheet.getByLabel('Datum').fill(item.date);
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByRole('button', { name: 'Planen' }).click();
	return sheet;
}

const available = (page: Page) => page.getByLabel('Verfügbar', { exact: true });
const minimum = (page: Page) => page.getByLabel('Mindestbestand', { exact: true });

test('minimum balance up to the next salary; warning without overdraft', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByLabel('Name').fill(ACCOUNT);
	await sheet.getByLabel('Betrag in €').fill('1.000');
	await sheet.getByLabel('Stand am').fill(today);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await createItem(page, { name: 'Lohn', amount: '2.000', date: addDays(today, 20), income: true });
	await createItem(page, { name: 'Miete', amount: '700', date: addDays(today, 5) });
	await planPayment(page, { name: 'Versicherung', amount: '500', date: addDays(today, 10) });

	await openAccount(page);
	await expect(page.getByText(`Verfügbar bis ${formatDay(salaryDay)}`)).toBeVisible();
	await expect(minimum(page)).toHaveText(/1\.200,00\s€/);
	await expect(available(page)).toHaveText(/−200,00\s€/);
	await expect(page.getByRole('alert')).toContainText('Das Konto rutscht ins Minus');
	const steps = page.getByRole('region', { name: 'Bis zum Stichtag fällig' });
	await expect(steps.getByRole('listitem').nth(1)).toContainText('tiefster Stand');
	await expect(steps).toContainText('Lohn');

	await page.goto('/konten');
	await expect(page.getByRole('link', { name: new RegExp(ACCOUNT) })).toContainText(
		/verfügbar −200,00\s€/
	);
});

test('with enough overdraft only a hint remains', async ({ page }) => {
	await login(page);
	await openAccount(page);
	await page.locator('main').getByLabel('Dispo-Rahmen in € (optional)').fill('500');
	await page.getByRole('button', { name: 'Sichern', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');
	await expect(page.getByRole('alert')).toHaveCount(0);
	await expect(page.getByText('Der Dispo reicht dafür.')).toBeVisible();
	// The overdraft never counts as available.
	await expect(available(page)).toHaveText(/−200,00\s€/);
});

test('the cut-off day can be a fixed date or a chosen income; logged', async ({ page }) => {
	await login(page);
	await openAccount(page);
	await page.getByRole('button', { name: /Stichtag/ }).click();
	const sheet = page.getByRole('dialog', { name: 'Stichtag' });
	await sheet.getByLabel('Rechnen bis').selectOption({ label: 'Festes Datum' });
	await sheet.getByLabel('Datum').fill(today);
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet.getByText('Der Stichtag muss in der Zukunft liegen.')).toBeVisible();
	await sheet.getByLabel('Datum').fill(addDays(today, 3));
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByText(`Verfügbar bis ${formatDay(addDays(today, 3))}`)).toBeVisible();
	await expect(minimum(page)).toHaveText(/0,00\s€/);
	await expect(available(page)).toHaveText(/1\.000,00\s€/);

	await page.getByRole('button', { name: /Stichtag/ }).click();
	await sheet.getByLabel('Rechnen bis').selectOption({ label: 'Nächster Gehaltseingang' });
	await sheet.getByLabel('Eingang').selectOption({ label: 'Lohn (Gehalt)' });
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('button', { name: /Stichtag/ })).toContainText('Lohn');
	await expect(available(page)).toHaveText(/−200,00\s€/);

	await page.goto('/einstellungen/protokoll?bereich=account');
	await page.getByRole('button').filter({ hasText: ACCOUNT }).first().click();
	await expect(page.getByRole('dialog', { name: 'Eintrag' })).toContainText('Stichtag-Eingang');
});

test('the buffer always adds to the minimum balance', async ({ page }) => {
	await login(page);
	await openAccount(page);
	await page.locator('main').getByLabel('Puffer in € (optional)').fill('150');
	await page.getByRole('button', { name: 'Sichern', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');
	await expect(minimum(page)).toHaveText(/1\.350,00\s€/);
	await expect(page.getByText('davon Puffer')).toBeVisible();
	await expect(available(page)).toHaveText(/−350,00\s€/);

	await page.goto('/einstellungen/protokoll?bereich=account');
	await page.getByRole('button').filter({ hasText: ACCOUNT }).first().click();
	await expect(page.getByRole('dialog', { name: 'Eintrag' })).toContainText('Puffer');
});

test('one-off payments after the cut-off day are only a hint', async ({ page }) => {
	await login(page);
	let sheet = await planPayment(page, {
		name: 'Urlaub',
		amount: '1.500',
		date: addDays(today, -1)
	});
	await expect(sheet.getByText('Das Datum darf nicht in der Vergangenheit liegen.')).toBeVisible();
	await sheet.getByLabel('Datum').fill(addDays(today, 60));
	await sheet.getByRole('button', { name: 'Planen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('„Urlaub“ ist geplant.');
	sheet = await planPayment(page, {
		name: 'Steuererstattung',
		amount: '300',
		date: addDays(today, 70),
		income: true
	});
	await expect(sheet).toBeHidden();
	const upcoming = page.getByRole('region', { name: 'Anstehend' });
	await expect(upcoming.getByRole('link', { name: /Versicherung/ })).toBeVisible();
	await expect(upcoming.getByRole('link', { name: /Urlaub/ })).toContainText(/−1\.500,00\s€/);
	await expect(upcoming.getByRole('link', { name: /Steuererstattung/ })).toContainText(
		/\+300,00\s€/
	);

	// One-off payments are not listed among the recurring items.
	await page.goto('/dauerposten');
	await expect(page.getByRole('link', { name: /^Urlaub / })).toHaveCount(0);

	await openAccount(page);
	const later = page.getByRole('region', { name: 'Danach geplant' });
	await expect(later).toContainText('Urlaub');
	await expect(later).toContainText('Steuererstattung');
	await expect(minimum(page)).toHaveText(/1\.350,00\s€/);

	await later.getByRole('link', { name: /Urlaub/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Urlaub' })).toBeVisible();
	await openTab(page, 'Bearbeiten');
	await page.getByRole('button', { name: 'Dauerposten löschen' }).click();
	await page
		.getByRole('dialog', { name: 'Dauerposten löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page).toHaveURL('/geplant');
});

test('the 12-month forecast shows the lowest point', async ({ page }) => {
	await login(page);
	await openAccount(page);
	const forecast = page.getByRole('region', { name: 'Vorschau 12 Monate' });
	await expect(
		forecast.getByRole('img', { name: 'Kontostand in den nächsten 12 Monaten' })
	).toBeVisible();
	// 1.000 € − 700 € rent − 500 € insurance, before the first salary.
	await expect(forecast.getByLabel('Tiefster Stand')).toHaveText(
		new RegExp(
			`^−200,00\\s€ am ${formatDay(nextBankDay(addDays(today, 10))).replace(/\./g, '\\.')}$`
		)
	);
	// The overdraft of 500 € covers it.
	await expect(forecast.getByTestId('forecast-warning')).toHaveCount(0);
});

test('what if: cancel the rent, add a new expense', async ({ page }) => {
	await login(page);
	await page.goto('/was-waere-wenn');
	await page.getByRole('button', { name: 'Szenario anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Szenario' });
	await sheet.getByLabel('Name').fill('Ohne Miete');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Ohne Miete' })).toBeVisible();
	const effect = page.getByRole('listitem', { name: 'Verfügbar', exact: true });
	await expect(effect).toContainText(/−350,00\s€/);

	const add = async (fill: () => Promise<void>) => {
		await page.getByRole('button', { name: 'Änderung hinzufügen' }).click();
		await fill();
		await page
			.getByRole('dialog', { name: 'Änderung' })
			.getByRole('button', { name: 'Hinzufügen' })
			.click();
		await expect(page.getByRole('status')).toHaveText('Änderung hinzugefügt.');
	};
	const change = page.getByRole('dialog', { name: 'Änderung' });
	await add(async () => {
		await change.getByLabel('Art').selectOption({ label: 'Posten kündigen' });
		await change.getByLabel('Dauerposten').selectOption({ label: 'Miete (700,00 €)' });
	});
	// Without the rent only the insurance (500 €) lowers the balance, plus the buffer of 150 €.
	await expect(effect).toContainText(/350,00\s€\s*\+700,00\s€/);

	await add(async () => {
		await change.getByLabel('Bezeichnung', { exact: true }).fill('Autoabo');
		await change.getByLabel('Betrag in €').fill('100');
		await change.getByLabel('Ab', { exact: true }).fill(addDays(today, 3));
	});
	await expect(effect).toContainText(/250,00\s€/);
	await expect(page.getByRole('region', { name: 'Probeweise Änderungen' })).toContainText(
		'Neue Ausgabe: Autoabo'
	);

	// The real account is unchanged.
	await openAccount(page);
	await expect(available(page)).toHaveText(/−350,00\s€/);
});
