import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { formatDay, todayBerlin } from '../../src/lib/dates';
import { addMonths } from '../../src/lib/recurring';

// Runs after recurring (admin "erika", giro account "Alltagskonto").
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const today = todayBerlin();
const CHANGE = `${addMonths(today, 2).slice(0, 7)}-01`;

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('planning a change shows old, new and the difference', async ({ page }) => {
	await login(page);
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const create = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await create.getByLabel('Bezeichnung', { exact: true }).fill('Fitnessstudio');
	await create.getByLabel('Betrag in €').fill('30');
	await create.getByLabel('Konto').selectOption({ label: 'Alltagskonto' });
	await create.getByRole('button', { name: 'Anlegen' }).click();
	await expect(create).toBeHidden();

	await page.getByRole('link', { name: /Fitnessstudio/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Fitnessstudio' })).toBeVisible();
	await openTab(page, 'Betrag');
	await page.getByRole('button', { name: 'Änderung planen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Änderung planen' });
	await sheet.getByLabel('Gültig ab').fill(CHANGE);
	await sheet.getByLabel('Betrag in €').fill('35');
	const preview = sheet.getByRole('region', { name: 'Vorschau' });
	await expect(preview).toContainText(/Bisher\s*30,00\s€/);
	await expect(preview).toContainText(/Neu\s*35,00\s€/);
	await expect(preview).toContainText(/Differenz\s*\+5,00\s€ · \+16,7 %/);
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('list', { name: 'Betragsverlauf' })).toContainText(
		/geplant · 35,00\s€/
	);
	// Until then the old amount counts.
	await expect(page.getByTestId('current-amount')).toHaveText(/−30,00\s€/);
});

test('the list shows planned changes and the monthly totals from then on', async ({ page }) => {
	await login(page);
	await page.goto('/dauerposten');
	const day = formatDay(CHANGE).replace(/\./g, '\\.');

	const row = page
		.getByRole('region', { name: 'Alltagskonto' })
		.getByRole('link', { name: /Fitnessstudio/ });
	await expect(row).toContainText(new RegExp(`ab ${day}: 35,00\\s€`));

	const planned = page
		.getByRole('region', { name: 'Geplante Änderungen' })
		.getByRole('link', { name: /Fitnessstudio/ });
	await expect(planned).toContainText(new RegExp(`ab ${day}`));
	await expect(planned).toContainText(/30,00\s€ → 35,00\s€/);
	await expect(planned).toContainText(/\+5,00\s€/);
	await expect(planned).toContainText('+16,7 %');

	await expect(page.getByRole('region', { name: 'Alltagskonto' })).toContainText(
		new RegExp(`Ab ${day}: Ausgaben [\\d.,]+\\s€ \\(\\+5,00\\s€\\)`)
	);
});
