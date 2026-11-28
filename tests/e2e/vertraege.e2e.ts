import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { formatDay, todayBerlin } from '../../src/lib/dates';
import { addDays, addMonths } from '../../src/lib/recurring';
import { noticeDeadline } from '../../src/lib/contracts';

// Runs after recurring (admin "erika", giro account "Alltagskonto").
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const today = todayBerlin();
// Term ends in a bit more than three months: with three months notice the deadline is
// about ten days away, inside the default lead of 30 days.
const TERM_END = addDays(addMonths(today, 3), 10);
const DEADLINE = noticeDeadline({ noticeEvery: 3, noticeUnit: 'month' }, TERM_END);

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openCreateSheet(page: Page) {
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	return page.getByRole('dialog', { name: 'Neuer Dauerposten' });
}

/** A list row "label … value" in the text of a group. */
function row(label: string, value: string) {
	return new RegExp(`${label}\\s*${value.replace(/[.]/g, '\\.')}`);
}

function soonList(page: Page) {
	return page.getByRole('region', { name: 'Bald kündbar' });
}

async function setDefaultLead(page: Page, days: string) {
	await page.goto('/einstellungen');
	await page.getByLabel('Standard-Vorlauf in Tagen').fill(days);
	await page.getByRole('button', { name: 'Vorlauf sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Vorlauf gesichert.');
}

test('a cancellable contract with renewal appears as "bald kündbar"', async ({ page }) => {
	await login(page);
	const sheet = await openCreateSheet(page);
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill('Handyvertrag');
	await sheet.getByLabel('Betrag in €').fill('29,99');
	await sheet.getByLabel('Konto').selectOption({ label: 'Alltagskonto' });
	await sheet.getByRole('switch', { name: /Kündbarer Vertrag/ }).check();
	await sheet.getByLabel('Verlängerung', { exact: true }).selectOption({
		label: 'Keine'
	});
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet.getByText('Bitte das Ende der Laufzeit angeben.')).toBeVisible();

	await sheet.getByLabel('Verlängerung', { exact: true }).selectOption({
		label: 'Um feste Zeit'
	});
	await sheet.getByLabel('Laufzeit bis').fill(TERM_END);
	await sheet.getByLabel('Kündigungsfrist', { exact: true }).fill('3');
	await sheet.getByLabel('Frist in').selectOption({ label: 'Monate' });
	await expect(sheet.getByLabel('Verlängerung um (Monate)')).toHaveValue('12');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	const soon = soonList(page).getByRole('link', { name: /Handyvertrag/ });
	await expect(soon).toContainText(row('bis ', formatDay(DEADLINE)));
	await expect(soon).toContainText(row('kündbar zum ', formatDay(TERM_END)));

	await soon.click();
	const contract = page.getByRole('region', { name: 'Vertrag' });
	await expect(contract).toContainText(row('Kündigen bis', formatDay(DEADLINE)));
	await expect(contract).toContainText(row('Vertragsende dann', formatDay(TERM_END)));
	await expect(contract).toContainText(row('Kündigungsfrist', '3 Monate'));
	await expect(contract).toContainText(row('Verlängerung', 'um 12 Monate'));
	await expect(contract).toContainText('Die Kündigungsfrist läuft bald ab.');
});

test('the default lead time is an admin setting; each contract can override it', async ({
	page
}) => {
	await login(page);
	await setDefaultLead(page, '5');
	await page.goto('/dauerposten');
	await expect(soonList(page)).toHaveCount(0);

	await page.getByRole('link', { name: /Handyvertrag/ }).click();
	await openTab(page, 'Bearbeiten');
	await page.getByLabel('Vorlauf in Tagen (optional)').fill('60');
	await page.getByRole('button', { name: 'Sichern', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');
	await page.goto('/dauerposten');
	await expect(soonList(page).getByRole('link', { name: /Handyvertrag/ })).toBeVisible();

	await setDefaultLead(page, '30');
});

test('"Gekündigt am" sets the end of the recurring item', async ({ page }) => {
	await login(page);
	await page.goto('/dauerposten');
	await page
		.getByRole('link', { name: /Handyvertrag/ })
		.first()
		.click();
	await openTab(page, 'Bearbeiten');
	await page.getByLabel('Gekündigt am (optional)').fill(today);
	await page.getByRole('button', { name: 'Sichern', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');

	await openTab(page, 'Übersicht');
	const contract = page.getByRole('region', { name: 'Vertrag' });
	await expect(contract).toContainText(row('Gekündigt am', formatDay(today)));
	await expect(contract).toContainText(row('Vertragsende', formatDay(TERM_END)));
	await openTab(page, 'Bearbeiten');
	await expect(page.getByLabel('Ende (optional)')).toHaveValue(TERM_END);

	await page.goto('/dauerposten');
	await expect(soonList(page)).toHaveCount(0);
	await expect(page.getByRole('link', { name: /Handyvertrag/ })).toContainText(
		`gekündigt zum ${formatDay(TERM_END)}`
	);
});

test('income has no contract data; the protocol records the cancellation', async ({ page }) => {
	await login(page);
	const sheet = await openCreateSheet(page);
	await sheet.getByText('Einnahme', { exact: true }).click();
	await expect(sheet.getByRole('switch', { name: /Kündbarer Vertrag/ })).toHaveCount(0);
	await sheet.getByRole('button', { name: 'Abbrechen' }).click();

	await page.goto('/einstellungen/protokoll?bereich=recurring');
	await page
		.getByRole('button')
		.filter({ hasText: 'Dauerposten geändert' })
		.filter({ hasText: 'Handyvertrag' })
		.first()
		.click();
	const entry = page.getByRole('dialog', { name: 'Eintrag' });
	await expect(entry.getByText('Gekündigt am')).toBeVisible();

	await page.goto('/einstellungen/protokoll?bereich=settings');
	await expect(page.getByRole('button').filter({ hasText: 'Einstellungen' }).first()).toBeVisible();
});
