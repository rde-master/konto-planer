import { expect, test, type Page } from '@playwright/test';
import { formatDay, todayBerlin } from '../../src/lib/dates';
import { addDays, addMonths } from '../../src/lib/recurring';
import { noticeDeadline } from '../../src/lib/contracts';

// Start page: household, available per giro account, next 7 days, cancel soon.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Startkonto';
const today = todayBerlin();
const TERM_END = addDays(addMonths(today, 3), 10);
const DEADLINE = noticeDeadline({ noticeEvery: 3, noticeUnit: 'month' }, TERM_END);

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('the start page shows household, accounts, next payments and contracts', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('750');
	await account.getByLabel('Stand am').fill(addDays(today, -3));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill('Kinderturnen Start');
	await sheet.getByLabel('Betrag in €').fill('20');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Erste Fälligkeit').fill(addDays(today, 3));
	await sheet.getByRole('switch', { name: /Kündbarer Vertrag/ }).check();
	await sheet.getByLabel('Verlängerung', { exact: true }).selectOption({ label: 'Um feste Zeit' });
	await sheet.getByLabel('Laufzeit bis').fill(TERM_END);
	await sheet.getByLabel('Kündigungsfrist', { exact: true }).fill('3');
	await sheet.getByLabel('Frist in').selectOption({ label: 'Monate' });
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await page.goto('/');
	await expect(page.getByLabel('Summe aller Konten')).toHaveText(/€/);
	const available = page.getByRole('region', { name: 'Verfügbar' });
	// The accounts one by one stand first on the page.
	await expect(page.getByRole('main').getByRole('region').first()).toHaveAttribute(
		'aria-label',
		'Verfügbar'
	);
	// Right side: the balance today on top, below it the amount up to the cut-off day.
	const row = available.getByRole('link', { name: `${ACCOUNT} verfügbar` });
	await expect(row).toContainText(/750,00\s€/);
	await expect(row).toContainText(/bis \d{2}\.\d{2}\.: /);

	const next = page.getByRole('region', { name: 'Nächste 7 Tage' });
	await expect(next.getByRole('link', { name: /Kinderturnen Start/ })).toContainText(/−20,00\s€/);

	const soon = page.getByRole('region', { name: 'Bald kündbar' });
	await expect(soon.getByRole('link', { name: /Kinderturnen Start/ })).toContainText(
		`kündigen bis ${formatDay(DEADLINE)}`
	);

	await available.getByRole('link', { name: `${ACCOUNT} verfügbar` }).click();
	await expect(page.getByRole('heading', { level: 1, name: ACCOUNT })).toBeVisible();
});
