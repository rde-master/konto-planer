import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Monthly budget per category and account, with its own account.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Budgetkonto';

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
	await sheet.getByLabel('Kategorie').selectOption({ label: 'Supermarkt' });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(payee);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
}

test('a budget shows what is left after each booking', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('500');
	await account.getByLabel('Stand am').fill(addDays(todayBerlin(), -5));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/mehr');
	await page.getByRole('link', { name: 'Budgets' }).click();
	await page.getByRole('button', { name: 'Budget anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Budget' });
	await sheet.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel (allgemein)' });
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Grenze im Monat in €').fill('0');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet.getByText('Bitte einen Betrag größer 0 eingeben.')).toBeVisible();
	await sheet.getByLabel('Grenze im Monat in €').fill('100');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Budget angelegt.');

	await book(page, 'Wochenmarkt Budget', '85');
	await expect(page.getByRole('status')).toContainText(/Lebensmittel: noch 15,00\s€ diesen Monat/);

	await page.goto('/budgets');
	const row = page.getByRole('listitem', { name: `Lebensmittel · ${ACCOUNT}` });
	await expect(row).toContainText(/85,00\s€ \/ 100,00\s€/);
	await expect(row).toContainText(/noch 15,00\s€/);

	// From 80 % on the start page shows it.
	await page.goto('/');
	await expect(page.getByRole('region', { name: 'Budgets' })).toContainText('85 %');
});

test('over the limit; the budget can be deleted', async ({ page }) => {
	await login(page);
	await book(page, 'Feinkost Budget', '30');
	await expect(page.getByRole('status')).toContainText(
		/Lebensmittel: Budget um 15,00\s€ überschritten/
	);

	await page.goto('/budgets');
	const row = page.getByRole('listitem', { name: `Lebensmittel · ${ACCOUNT}` });
	await expect(row).toContainText(/15,00\s€ drüber/);
	await row.getByRole('button').click();
	await page
		.getByRole('dialog', { name: 'Budget' })
		.getByRole('button', { name: 'Budget löschen' })
		.click();
	await expect(page.getByRole('status')).toHaveText('Budget gelöscht.');
	await expect(page.getByRole('listitem', { name: `Lebensmittel · ${ACCOUNT}` })).toHaveCount(0);

	await page.goto('/einstellungen/protokoll?bereich=budget');
	await expect(
		page.getByRole('button').filter({ hasText: 'Budget angelegt' }).first()
	).toBeVisible();
});
