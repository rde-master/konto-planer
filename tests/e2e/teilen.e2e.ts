import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Shared expenses and settlements between two users; the other one cannot see the account.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123', name: 'Erika Muster' };
const TOM = { name: 'Tom Teiler', username: 'tom', password: 'tom-teilt-gern-1' };
const ACCOUNT = 'Teilkonto';
const PAYEE = 'Ferienhaus Teilen';

async function login(page: Page, user: { username: string; password: string }) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(user.username);
	await page.getByLabel('Passwort', { exact: true }).fill(user.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('an expense is shared; the shares must add up to 100 %', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/einstellungen/benutzer');
	await page.getByRole('button', { name: 'Benutzer anlegen' }).click();
	const userSheet = page.getByRole('dialog', { name: 'Neuer Benutzer' });
	await userSheet.getByLabel('Name', { exact: true }).fill(TOM.name);
	await userSheet.getByLabel('Benutzername').fill(TOM.username);
	await userSheet.getByLabel('Passwort', { exact: true }).fill(TOM.password);
	await userSheet.getByLabel('Passwort wiederholen').fill(TOM.password);
	await userSheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(userSheet).toBeHidden();

	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('1.000');
	await account.getByLabel('Stand am').fill(addDays(todayBerlin(), -5));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('300');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(PAYEE);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	await page.getByRole('link', { name: new RegExp(PAYEE) }).click();
	await openTab(page, 'Einordnen');
	await page.getByRole('button', { name: 'Als gemeinsame Ausgabe markieren' }).click();
	const shared = page.getByRole('dialog', { name: 'Gemeinsame Ausgabe' });
	// Only Erika and Tom take part.
	for (const box of await shared.getByRole('checkbox').all()) await box.uncheck();
	await shared.getByLabel(ADMIN.name, { exact: true }).check();
	await shared.getByLabel(TOM.name, { exact: true }).check();
	await shared.getByLabel(`Anteil ${ADMIN.name} in %`).fill('70');
	await shared.getByLabel(`Anteil ${TOM.name} in %`).fill('20');
	await shared.getByRole('button', { name: 'Sichern' }).click();
	await expect(shared.getByRole('alert')).toContainText('ergeben 90 % statt 100 %');
	await shared.getByLabel(`Anteil ${TOM.name} in %`).fill('30');
	await shared.getByRole('button', { name: 'Sichern' }).click();
	await expect(shared).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Gemeinsame Ausgabe gesichert.');
	await openTab(page, 'Einordnen');
	const region = page.getByRole('region', { name: 'Gemeinsame Ausgabe' });
	await expect(region).toContainText(ADMIN.name);
	await expect(region).toContainText(/30 % · 90,00\s€/);

	await page.goto('/ausgleich');
	await expect(page.getByLabel('Dein Saldo')).toHaveText(/90,00\s€/);
	await expect(page.getByRole('region', { name: 'Dein Stand' })).toContainText('Du bekommst');
});

test('the other user sees only the expense and settles', async ({ page }) => {
	await login(page, TOM);
	await page.goto('/ausgleich');
	await expect(page.getByRole('region', { name: 'Dein Stand' })).toContainText('Du schuldest');
	await expect(page.getByLabel('Dein Saldo')).toHaveText(/90,00\s€/);
	const expenses = page.getByRole('region', { name: 'Gemeinsame Ausgaben' });
	await expect(expenses).toContainText(PAYEE);
	await expect(expenses).toContainText(/dein Anteil 90,00\s€/);
	// No access to the account: no link to the booking.
	await expect(expenses.getByRole('link')).toHaveCount(0);

	await page
		.getByRole('button', { name: /^Ausgleich Tom Teiler an Erika Muster erfassen/ })
		.click();
	const sheet = page.getByRole('dialog', { name: 'Ausgleich erfassen' });
	await expect(sheet.getByLabel('Betrag in €')).toHaveValue('90,00');
	await sheet.getByLabel('Betrag in €').fill('50');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Ausgleich erfasst.');
	await expect(page.getByLabel('Dein Saldo')).toHaveText(/40,00\s€/);
	await expect(page.getByRole('region', { name: 'Ausgleiche' })).toContainText(/50,00\s€/);
});

test('removing the share clears the balance; logged', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/buchungen');
	await page.getByRole('link', { name: new RegExp(PAYEE) }).click();
	await openTab(page, 'Einordnen');
	await page.getByRole('button', { name: 'Nicht mehr gemeinsam' }).click();
	await expect(page.getByRole('region', { name: 'Gemeinsame Ausgabe' })).toHaveCount(0);

	// Only Tom's 50 € remain: Erika owes them back.
	await page.goto('/ausgleich');
	await expect(page.getByRole('region', { name: 'Dein Stand' })).toContainText('Du schuldest');
	await expect(page.getByLabel('Dein Saldo')).toHaveText(/50,00\s€/);

	await page.goto('/einstellungen/protokoll?bereich=settlement');
	await expect(
		page.getByRole('button').filter({ hasText: 'Ausgleich angelegt' }).first()
	).toBeVisible();
});
