import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { formatDay, todayBerlin } from '../../src/lib/dates';
import { addDays, addMonths } from '../../src/lib/recurring';

// Cancellation letter as PDF from the contract data (runs late: other tests expect no items).
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Briefkonto';
const ITEM = 'Kraftraum Brief';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('a cancellation letter is created, stored and the contract marked as cancelled', async ({
	page
}) => {
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
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill(ITEM);
	await sheet.getByLabel('Betrag in €').fill('29,90');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Erste Fälligkeit').fill(addDays(today, 5));
	await sheet.getByRole('switch', { name: /Kündbarer Vertrag/ }).check();
	await sheet.getByLabel('Verlängerung', { exact: true }).selectOption({ label: 'Um feste Zeit' });
	await sheet.getByLabel('Laufzeit bis').fill(addMonths(today, 6));
	await sheet.getByLabel('Kündigungsfrist', { exact: true }).fill('1');
	await sheet.getByLabel('Frist in').selectOption({ label: 'Monate' });
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await page.getByRole('link', { name: new RegExp(ITEM) }).click();
	await page.getByRole('link', { name: 'Kündigungsschreiben erstellen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Kündigung' })).toBeVisible();
	await expect(page.getByLabel('Firma')).toHaveValue(ITEM);

	// The address is needed.
	await page.getByRole('button', { name: 'Kündigungsschreiben erstellen (PDF)' }).click();
	await expect(page.getByText('Bitte Straße, PLZ und Ort eingeben.')).toBeVisible();

	await page.getByLabel('Straße und Hausnummer').fill('Musterweg 1');
	await page.getByLabel('PLZ').first().fill('12345');
	await page.getByLabel('Ort', { exact: true }).first().fill('Musterstadt');
	await page.getByLabel('Firma').fill('Fitness Beispiel GmbH');
	await page.getByLabel('Straße oder Postfach').fill('Hauptstraße 5');
	await page.getByLabel('PLZ').nth(1).fill('54321');
	await page.getByLabel('Ort', { exact: true }).nth(1).fill('Beispielhausen');
	await page.getByRole('button', { name: 'Kündigungsschreiben erstellen (PDF)' }).click();

	const done = page.getByRole('region', { name: 'Schreiben erstellt' });
	await expect(done).toBeVisible();
	const href = await done.getByRole('link', { name: 'PDF herunterladen' }).getAttribute('href');
	const pdf = await page.request.get(href!);
	expect(pdf.ok()).toBe(true);
	expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

	await done.getByRole('button', { name: `„Gekündigt am ${formatDay(today)}“ eintragen` }).click();
	await expect(page.getByRole('heading', { level: 1, name: ITEM })).toBeVisible();
	await expect(page.getByText('Gekündigt am', { exact: true })).toBeVisible();
	// Stored as attachment at the item.
	await openTab(page, 'Mehr');
	await expect(page.getByRole('main')).toContainText(/Kuendigung-Kraftraum-Brief/);

	// The sender address is remembered.
	await page.goto(page.url() + '/kuendigung');
	await expect(page.getByLabel('Straße und Hausnummer')).toHaveValue('Musterweg 1');
});
