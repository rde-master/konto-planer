import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Company logos (Simple Icons): matched by payee name, chosen by hand per payee.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Logokonto';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function book(page: Page, payee: string, amount: string) {
	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill(amount);
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(payee);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
}

test('logos are matched by payee; others get initials', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('500');
	await account.getByLabel('Stand am').fill(addDays(today, -5));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const item = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await item.getByLabel('Bezeichnung', { exact: true }).fill('Netflix');
	await item.getByLabel('Betrag in €').fill('12,99');
	await item.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await item.getByLabel('Erste Fälligkeit').fill(addDays(today, 5));
	await item.getByRole('button', { name: 'Anlegen' }).click();
	await expect(item).toBeHidden();
	await expect(
		page.getByRole('link', { name: /^Netflix/ }).locator('img[src="/api/logos/netflix"]')
	).toBeVisible();

	await book(page, 'PAYPAL (EUROPE) S.A.R.L.', '5');
	await book(page, 'Kiosk am Eck', '3');
	await expect(
		page.getByRole('link', { name: /PAYPAL/ }).locator('img[src="/api/logos/paypal"]')
	).toBeVisible();
	await expect(page.getByRole('link', { name: /Kiosk am Eck/ })).toContainText('KA');

	const svg = await page.request.get('/api/logos/netflix');
	expect(svg.headers()['content-type']).toContain('image/svg+xml');
	expect(await svg.text()).toContain('<svg');
});

test('a logo is chosen by hand for the payee, and back to initials', async ({ page }) => {
	await login(page);
	await page.goto('/buchungen');
	await page.getByRole('link', { name: /Kiosk am Eck/ }).click();
	await openTab(page, 'Einordnen');
	await page.getByRole('button', { name: 'Logo ändern' }).click();
	const sheet = page.getByRole('dialog', { name: 'Logo' });
	await sheet.getByLabel('Logo suchen').fill('spotify');
	await sheet.getByRole('list', { name: 'Logos' }).getByRole('button', { name: 'Spotify' }).click();
	await expect(page.getByRole('status')).toHaveText('Logo gesichert.');
	await expect(page.locator('main img[src="/api/logos/spotify"]').first()).toBeVisible();
	await expect(page.locator('main')).toContainText('Von Hand gewählt');

	await page.getByRole('button', { name: 'Logo ändern' }).click();
	await sheet.getByRole('button', { name: 'Kein Logo (Initialen)' }).click();
	await expect(page.getByRole('status')).toHaveText('Logo gesichert.');
	await expect(page.locator('main img[src="/api/logos/spotify"]')).toHaveCount(0);
});

test('logos need a session', async ({ browser }) => {
	const context = await browser.newContext();
	const res = await context.request.get('/api/logos/netflix', { maxRedirects: 0 });
	expect([302, 303, 401]).toContain(res.status());
	await context.close();
});
