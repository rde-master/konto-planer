import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Trash: deleted objects come back with their data and assignments. Runs last on purpose.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Papierkonto';
const PAYEE = 'Altpapierhandel';
const CATEGORY = 'Wertstoffe';

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function restore(page: Page, label: RegExp) {
	await page.goto('/papierkorb');
	await page
		.getByRole('button', { name: new RegExp(`${label.source}.* wiederherstellen`) })
		.click();
	await expect(page.getByRole('status')).toContainText('ist wiederhergestellt');
}

test('a deleted booking comes back with its category and tag', async ({ page }) => {
	await login(page);
	await page.goto('/kategorien');
	await page.getByRole('button', { name: 'Kategorie anlegen' }).click();
	const cat = page.getByRole('dialog', { name: 'Neue Kategorie' });
	await cat.getByLabel('Name').fill(CATEGORY);
	await cat.getByRole('button', { name: 'Anlegen' }).click();
	await expect(cat).toBeHidden();

	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('100');
	await account.getByLabel('Stand am').fill(addDays(todayBerlin(), -5));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('7,50');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Kategorie').selectOption({ label: `${CATEGORY} (allgemein)` });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(PAYEE);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	await page.getByRole('link', { name: new RegExp(PAYEE) }).click();
	await page.getByRole('button', { name: 'Tags ändern' }).click();
	const tags = page.getByRole('dialog', { name: 'Tags' });
	await tags.getByLabel('Neuer Tag').fill('Recycling');
	await tags.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Tags gesichert.');

	await page.getByRole('button', { name: 'Buchung löschen' }).click();
	await page
		.getByRole('dialog', { name: 'Buchung löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page).toHaveURL('/buchungen');
	await expect(page.getByRole('link', { name: new RegExp(PAYEE) })).toHaveCount(0);

	await restore(page, new RegExp(PAYEE));
	await page.goto('/buchungen');
	await page.getByRole('link', { name: new RegExp(PAYEE) }).click();
	await expect(page.locator('main')).toContainText(CATEGORY);
	await expect(
		page.getByRole('region', { name: 'Tags' }).getByRole('link', { name: 'Recycling' })
	).toBeVisible();
});

test('a deleted category comes back with its assignments', async ({ page }) => {
	await login(page);
	await page.goto('/kategorien');
	await page
		.getByRole('region', { name: CATEGORY, exact: true })
		.getByRole('button', { name: CATEGORY })
		.click();
	await page
		.getByRole('dialog', { name: 'Kategorie', exact: true })
		.getByRole('button', { name: 'Kategorie löschen' })
		.click();
	await page
		.getByRole('dialog', { name: 'Kategorie löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page.getByRole('status')).toContainText('wurde gelöscht');

	await page.goto('/buchungen');
	await expect(page.getByRole('link', { name: new RegExp(PAYEE) })).toContainText('Ohne Kategorie');

	await restore(page, new RegExp(CATEGORY));
	await page.goto('/buchungen');
	await expect(page.getByRole('link', { name: new RegExp(PAYEE) })).toContainText(CATEGORY);
});

test('a deleted recurring item comes back with its due dates; logged', async ({ page }) => {
	await login(page);
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await sheet.getByLabel('Bezeichnung').fill('Zeitschrift Wertstoff');
	await sheet.getByLabel('Betrag in €').fill('9,90');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Erste Fälligkeit').fill(addDays(todayBerlin(), 10));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await page.getByRole('link', { name: /^Zeitschrift Wertstoff/ }).click();
	await page.getByRole('button', { name: 'Dauerposten löschen' }).click();
	await page
		.getByRole('dialog', { name: 'Dauerposten löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page).toHaveURL('/dauerposten');
	await expect(page.getByRole('link', { name: /^Zeitschrift Wertstoff/ })).toHaveCount(0);

	await restore(page, /Zeitschrift Wertstoff/);
	await page.goto('/dauerposten');
	await page.getByRole('link', { name: /^Zeitschrift Wertstoff/ }).click();
	await expect(page.getByRole('region', { name: 'Nächste Fälligkeiten' })).toContainText(/9,90\s€/);

	await page.goto('/einstellungen/protokoll?bereich=recurring');
	await expect(
		page.getByRole('button').filter({ hasText: 'Dauerposten wiederhergestellt' }).first()
	).toBeVisible();
});

test('the admin empties the trash', async ({ page }) => {
	await login(page);
	await page.goto('/tags');
	await page.getByRole('link', { name: /Recycling/ }).click();
	await page.getByRole('button', { name: 'Tag löschen' }).click();
	await page
		.getByRole('dialog', { name: 'Tag löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await page.goto('/papierkorb');
	await expect(page.getByRole('listitem', { name: 'Recycling' })).toBeVisible();
	await page.getByRole('button', { name: 'Papierkorb leeren' }).click();
	await page
		.getByRole('dialog', { name: 'Papierkorb leeren' })
		.getByRole('button', { name: 'Leeren' })
		.click();
	await expect(page.getByText('Der Papierkorb ist leer')).toBeVisible();
});
