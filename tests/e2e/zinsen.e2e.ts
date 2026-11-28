import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { dayLabel, formatDay, todayBerlin } from '../../src/lib/dates';

// Own savings account opened on 1 January of last year: last year's interest is final.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Tagesgeld';
const lastYear = Number(todayBerlin().slice(0, 4)) - 1;
const opening = `${lastYear}-01-01`;
const yearEnd = `${lastYear}-12-31`;

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

/** Day group of the booking list (named like "Mi., 31. Dezember 2025"). */
function dayGroup(page: Page, day: string) {
	return page.getByRole('region', { name: dayLabel(new Date(`${day}T12:00:00Z`)), exact: true });
}

function creditLink(page: Page) {
	return dayGroup(page, yearEnd).getByRole('link', { name: /Zinsen/ });
}

test('a rate books last year’s interest provisionally', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByText('Sparbuch', { exact: true }).click();
	await sheet.getByLabel('Name').fill(ACCOUNT);
	await sheet.getByLabel('Betrag in €').fill('10.000');
	await sheet.getByLabel('Stand am').fill(opening);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await openAccount(page);
	await openTab(page, 'Zinsen');
	const zinsen = page.getByRole('region', { name: 'Zinsen', exact: true });
	await expect(zinsen.getByLabel('Zinssatz')).toHaveText('keiner');

	await page.getByRole('button', { name: 'Zinssatz ändern' }).click();
	const rate = page.getByRole('dialog', { name: 'Zinssatz ändern' });
	await rate.getByLabel('Zinssatz in % p. a.').fill('viel');
	await rate.getByRole('button', { name: 'Sichern' }).click();
	await expect(rate.getByText('Bitte einen Zinssatz wie 2,75 eingeben.')).toBeVisible();
	await rate.getByLabel('Zinssatz in % p. a.').fill('3');
	await rate.getByLabel('Gültig ab').fill(opening);
	await rate.getByRole('button', { name: 'Sichern' }).click();
	await expect(rate).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Zinssatz gesichert.');
	await expect(zinsen.getByLabel('Zinssatz')).toHaveText('3,00 % p. a.');
	await expect(zinsen.getByLabel('Erwartete Gutschrift')).toContainText('+');
	await expect(page.getByRole('img', { name: 'Kontostand im Verlauf' })).toBeVisible();

	// 10.000 € for a full year at 3 % (act/365, or 366 in a leap year).
	await page.goto('/buchungen');
	await expect(creditLink(page)).toContainText(/\+300,00\s€/);
});

test('the bank’s amount replaces the computed one, and back', async ({ page }) => {
	await login(page);
	await page.goto('/buchungen');
	await creditLink(page).click();
	await expect(page.getByRole('region', { name: 'Zinsgutschrift' })).toContainText(
		formatDay(yearEnd)
	);
	await page.getByRole('button', { name: 'Betrag anpassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Betrag anpassen' });
	await sheet.getByLabel('Zinsen laut Bank in €').fill('298,50');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.locator('main')).toContainText(/\+298,50\s€/);

	await page.getByRole('button', { name: 'Berechneten Betrag verwenden' }).click();
	await expect(page.locator('main')).toContainText(/\+300,00\s€/);
});

test('quarterly credits compound; changes are logged', async ({ page }) => {
	await login(page);
	await openAccount(page);
	await openTab(page, 'Zinsen');
	await page.getByLabel('Gutschrift', { exact: true }).selectOption({ label: 'vierteljährlich' });
	await expect(page.getByRole('status')).toHaveText('Rhythmus der Gutschrift gesichert.');

	await page.goto('/buchungen');
	const q4 = creditLink(page);
	await expect(q4).toBeVisible();
	// The fourth quarter earns interest on the credits of the first three.
	await expect(q4).not.toContainText('300,00');
	await expect(
		dayGroup(page, `${lastYear}-03-31`).getByRole('link', { name: /Zinsen/ })
	).toBeVisible();

	await page.goto('/einstellungen/protokoll?bereich=account');
	await expect(
		page.getByRole('button').filter({ hasText: 'Zinssatz geändert' }).first()
	).toBeVisible();
	await expect(
		page.getByRole('button').filter({ hasText: 'Zinsen gutgeschrieben' }).first()
	).toBeVisible();
});
