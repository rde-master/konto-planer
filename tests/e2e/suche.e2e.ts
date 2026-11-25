import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Search and filter on the booking list, with its own account.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Suchkonto';

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
	b: { payee: string; amount: string; income?: boolean; category?: string }
) {
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	if (b.income) await sheet.getByText('Einnahme', { exact: true }).click();
	await sheet.getByLabel('Betrag in €').fill(b.amount);
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	if (b.category) await sheet.getByLabel('Kategorie').selectOption({ label: b.category });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(b.payee);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
}

const hits = (page: Page) => page.getByLabel('Treffer');

test('text search finds payees; chips remove filters', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('1.000');
	await account.getByLabel('Stand am').fill(addDays(todayBerlin(), -5));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/buchungen');
	await book(page, {
		payee: 'Streamingdienst Suche',
		amount: '12,99',
		category: 'Abos und Streaming'
	});
	await book(page, { payee: 'Arbeitgeber Suche', amount: '2.000', income: true });
	await book(page, { payee: 'Kantine Suche', amount: '8,50' });
	await book(page, { payee: 'Tankstelle Suche', amount: '60' });

	await page.getByRole('searchbox').fill('kantine suche');
	await page.getByRole('searchbox').press('Enter');
	await expect(page).toHaveURL(/q=kantine/);
	await expect(hits(page)).toHaveText(/^1 Buchung · Summe −8,50\s€$/);
	await expect(page.getByRole('link', { name: /Kantine Suche/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /Tankstelle Suche/ })).toHaveCount(0);

	await page.getByRole('link', { name: 'Filter „kantine suche“ entfernen' }).click();
	await expect(hits(page)).toHaveCount(0);
	await expect(page.getByRole('link', { name: /Tankstelle Suche/ })).toBeVisible();

	await page.getByRole('searchbox').fill('gibt es nicht');
	await page.getByRole('searchbox').press('Enter');
	await expect(page.getByText('Keine Buchungen gefunden')).toBeVisible();
});

test('filters by account, direction, amount and category', async ({ page }) => {
	await login(page);
	// The account's booking link filters by account.
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await page
		.locator('main')
		.getByRole('link', { name: /Buchungen/ })
		.click();
	await expect(page).toHaveURL(/konto=/);

	await page.getByRole('button', { name: /^Filter/ }).click();
	const sheet = page.getByRole('dialog', { name: 'Filter' });
	await sheet.getByText('Ausgaben', { exact: true }).click();
	await sheet.getByLabel('Betrag ab in €').fill('10');
	await sheet.getByRole('button', { name: 'Anwenden' }).click();
	await expect(hits(page)).toHaveText(/^2 Buchungen · Summe −72,99\s€$/);
	const chips = page.getByRole('list', { name: 'Aktive Filter' });
	await expect(chips).toContainText('Ausgaben');
	await expect(chips).toContainText(/ab 10,00\s€/);

	// The filter is in the address: a reload keeps it.
	await page.reload();
	await expect(hits(page)).toHaveText(/^2 Buchungen/);

	await page.getByRole('button', { name: /^Filter/ }).click();
	await sheet.getByLabel('Kategorie').selectOption({ label: 'Abos und Streaming' });
	await sheet.getByRole('button', { name: 'Anwenden' }).click();
	await expect(hits(page)).toHaveText(/^1 Buchung · Summe −12,99\s€$/);
	await expect(page.getByRole('link', { name: /Streamingdienst Suche/ })).toBeVisible();

	await page.getByRole('button', { name: /^Filter/ }).click();
	await sheet.getByRole('button', { name: 'Alle Filter entfernen' }).click();
	await expect(hits(page)).toHaveCount(0);
	await expect(page).toHaveURL(/konto=/);
	await expect(page.getByRole('link', { name: /Arbeitgeber Suche/ })).toBeVisible();
});
