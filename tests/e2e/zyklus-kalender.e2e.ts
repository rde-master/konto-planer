import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Calendar subscription with a secret link; runs late (it adds a recurring item).
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Kalenderkonto';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('the subscription link delivers the chosen events', async ({ page, playwright }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('500');
	await account.getByLabel('Stand am').fill(today);
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill('Kalenderposten; Test');
	await sheet.getByLabel('Betrag in €').fill('42');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Erste Fälligkeit').fill(addDays(today, 3));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await page.goto('/einstellungen');
	await page.getByRole('link', { name: 'Kalender-Abo' }).click();
	await page.getByRole('button', { name: 'Abo-Link erzeugen' }).click();
	const link = (await page.getByTestId('calendar-link').textContent())!.trim();
	expect(link).toMatch(/\/api\/kalender\/[A-Za-z0-9_-]+\.ics$/);

	// Without login (a calendar app has no session).
	const anonymous = await playwright.request.newContext();
	let res = await anonymous.get(link);
	expect(res.headers()['content-type']).toContain('text/calendar');
	let ics = await res.text();
	expect(ics).toContain('BEGIN:VCALENDAR');
	expect(ics).toMatch(/SUMMARY:Kalenderposten\\; Test −42\\,00\s€/);

	// Without payments the item is gone.
	await page.getByLabel('Fälligkeiten der Dauerposten').uncheck();
	await page.getByRole('button', { name: 'Inhalt sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Kalender-Inhalt gesichert.');
	ics = await (await anonymous.get(link)).text();
	expect(ics).not.toContain('Kalenderposten');

	// A new link makes the old one useless.
	await page.getByRole('button', { name: 'Neuen Link erzeugen' }).click();
	await expect(page.getByTestId('calendar-link')).not.toHaveText(link);
	res = await anonymous.get(link);
	expect(res.status()).toBe(404);
	await anonymous.dispose();
});
