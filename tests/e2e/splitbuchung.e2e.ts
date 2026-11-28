import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// A manual booking split into categories, on its own account.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Splitkonto';
const PAYEE = 'Drogeriemarkt Split';

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openBooking(page: Page) {
	await page.goto('/buchungen');
	await page.getByRole('link', { name: new RegExp(PAYEE) }).click();
	await expect(page.getByRole('heading', { level: 1, name: PAYEE })).toBeVisible();
}

test('a booking is split; the rest keeps its category', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('500');
	await account.getByLabel('Stand am').fill(addDays(todayBerlin(), -10));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('50');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel (allgemein)' });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(PAYEE);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	await openBooking(page);
	await openTab(page, 'Einordnen');
	await page.getByRole('button', { name: 'Aufteilen' }).click();
	const split = page.getByRole('dialog', { name: 'Aufteilen' });
	await split.getByLabel('Betrag Teil 1').fill('12,50');
	await split.getByLabel('Kategorie Teil 1').selectOption({ label: 'Drogerie' });
	await split.getByLabel('Betrag Teil 2').fill('60');
	await split.getByLabel('Kategorie Teil 2').selectOption({ label: 'Supermarkt' });
	await expect(split.getByLabel('Rest beim Aufteilen')).toContainText('größer als der Betrag');
	await split.getByRole('button', { name: 'Sichern' }).click();
	await expect(split.getByRole('alert')).toContainText(
		'Die Teile sind zusammen größer als der Betrag der Buchung.'
	);
	await split.getByLabel('Betrag Teil 2').fill('20');
	await expect(split.getByLabel('Rest beim Aufteilen')).toHaveText(
		/Rest für Lebensmittel: −17,50\s€/
	);
	await split.getByRole('button', { name: 'Sichern' }).click();
	await expect(split).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Aufteilung gesichert.');

	await openTab(page, 'Einordnen');
	const parts = page.getByRole('region', { name: 'Aufteilung' });
	await expect(parts).toContainText('Drogerie');
	await expect(parts).toContainText('Supermarkt');
	await expect(parts.getByLabel('Rest')).toHaveText(/−17,50\s€/);

	await page.goto('/buchungen');
	await expect(page.getByRole('link', { name: new RegExp(PAYEE) })).toContainText(
		'aufgeteilt in 3 Kategorien'
	);
});

test('the amount cannot drop below the split; the split can be removed', async ({ page }) => {
	await login(page);
	await openBooking(page);
	await page.locator('main').getByLabel('Betrag in €', { exact: true }).fill('30');
	await page.getByRole('button', { name: 'Sichern', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Der Betrag passt nicht mehr zur Aufteilung');

	await openTab(page, 'Einordnen');
	await page.getByRole('button', { name: 'Aufteilung ändern' }).click();
	await page
		.getByRole('dialog', { name: 'Aufteilen' })
		.getByRole('button', { name: 'Aufteilung entfernen' })
		.click();
	await expect(page.getByRole('region', { name: 'Aufteilung' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Aufteilen' })).toBeVisible();

	await page.goto('/einstellungen/protokoll?bereich=booking');
	await page.getByRole('button').filter({ hasText: PAYEE }).first().click();
	await expect(page.getByRole('dialog', { name: 'Eintrag' })).toContainText('Aufteilung');
});
