import { expect, test, type Page } from '@playwright/test';
import { formatDay, todayBerlin } from '../../src/lib/dates';
import { addMonths } from '../../src/lib/recurring';
import { balanceOn, installmentsOf, loanPlan } from '../../src/lib/loans';
import { formatEuro } from '../../src/lib/money';

// A car loan repaid by a monthly expense that started a year ago.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Kreditkonto';
const ITEM = 'Autokredit';
const today = todayBerlin();
const firstDue = addMonths(today, -12);
const start = addMonths(firstDue, -1);
const schedule = {
	interval: 'monthly' as const,
	customEvery: null,
	customUnit: null,
	startDate: firstDue,
	endDate: null
};
const installments = installmentsOf(schedule, [{ amount: 500_00, validFrom: firstDue }], start);

function expected(extras: { date: string; amount: number }[] = []) {
	const plan = loanPlan({
		principal: 10_000_00,
		rate: 6000,
		startDate: start,
		installments,
		extras
	});
	return { plan, balance: balanceOn(plan, 10_000_00, today) };
}

/** formatEuro with a regular space, as Playwright normalises whitespace. */
function euro(cents: number) {
	return new RegExp(formatEuro(cents).replace(/\s/g, '\\s').replace('.', '\\.'));
}

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openItem(page: Page) {
	await page.goto('/dauerposten');
	await page.getByRole('link', { name: new RegExp(`^${ITEM}`) }).click();
	await expect(page.getByRole('heading', { level: 1, name: ITEM })).toBeVisible();
}

test('loan data gives remaining debt and end', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('8.000');
	await account.getByLabel('Stand am').fill(start);
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await sheet.getByLabel('Bezeichnung').fill(ITEM);
	await sheet.getByLabel('Betrag in €').fill('500');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Erste Fälligkeit').fill(firstDue);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await openItem(page);
	await page.getByRole('button', { name: 'Darlehen erfassen' }).click();
	const loan = page.getByRole('dialog', { name: 'Darlehen' });
	await loan.getByLabel('Darlehenssumme in €').fill('10.000');
	await loan.getByLabel('Zinssatz in % p. a. (Sollzins)').fill('viel');
	await loan.getByLabel('Beginn (Auszahlung)').fill(start);
	await loan.getByRole('button', { name: 'Sichern' }).click();
	await expect(loan.getByText('Bitte einen Zinssatz wie 3,5 eingeben.')).toBeVisible();
	await loan.getByLabel('Zinssatz in % p. a. (Sollzins)').fill('6');
	await loan.getByRole('button', { name: 'Sichern' }).click();
	await expect(loan).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Darlehensdaten gesichert.');

	const { plan, balance } = expected();
	const section = page.getByRole('region', { name: 'Darlehen' });
	await expect(section.getByLabel('Restschuld', { exact: true })).toHaveText(euro(balance));
	await expect(section.getByLabel('Abbezahlt am')).toHaveText(formatDay(plan.paidOff!));
	await expect(page.getByRole('region', { name: 'Nächste Raten' })).toContainText('Tilgung');
	await expect(page.getByRole('img', { name: 'Restschuld im Verlauf' })).toBeVisible();
});

test('an extra repayment lowers the debt; the end can be taken over', async ({ page }) => {
	await login(page);
	await openItem(page);
	await page.getByRole('button', { name: 'Sondertilgung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Sondertilgung' });
	await sheet.getByLabel('Datum').fill(today);
	await sheet.getByLabel('Betrag in €').fill('1.000');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();

	const { plan, balance } = expected([{ date: today, amount: 1_000_00 }]);
	const section = page.getByRole('region', { name: 'Darlehen' });
	await expect(section.getByLabel('Restschuld', { exact: true })).toHaveText(euro(balance));
	await expect(section.getByLabel('Abbezahlt am')).toHaveText(formatDay(plan.paidOff!));

	await page.getByRole('button', { name: /Ende übernehmen/ }).click();
	await expect(page.getByRole('status')).toHaveText('Ende übernommen.');
	await expect(page.getByRole('button', { name: /Ende übernehmen/ })).toHaveCount(0);

	await page.goto('/einstellungen/protokoll?bereich=recurring');
	await expect(
		page.getByRole('button').filter({ hasText: 'Sondertilgung geändert' }).first()
	).toBeVisible();
});
