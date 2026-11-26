import { expect, test, type Page } from '@playwright/test';

// Charts on the start page (uses the accounts and bookings of the earlier tests).
const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('the start page shows net worth, expenses by category and income against expenses', async ({
	page
}) => {
	await login(page);

	const worth = page.getByRole('region', { name: 'Vermögensverlauf' });
	await expect(worth.getByRole('img', { name: 'Vermögensverlauf mit Vorschau' })).toBeVisible();
	// The chart is drawn (SVG paths), not just an empty box.
	await expect(worth.locator('svg path').first()).toBeAttached();

	const expenses = page.getByRole('region', { name: 'Ausgaben nach Kategorie' });
	await expect(expenses.getByRole('list').getByRole('listitem').first()).toContainText(/€/);
	await expect(expenses.locator('svg path').first()).toBeAttached();

	const inOut = page.getByRole('region', { name: 'Einnahmen und Ausgaben' });
	await expect(
		inOut.getByRole('img', { name: 'Einnahmen und Ausgaben der letzten sechs Monate' })
	).toBeVisible();

	// Every giro account has its small balance line up to the cut-off day.
	await expect(
		page
			.getByRole('region', { name: 'Verfügbar' })
			.getByRole('img', { name: /^Verlauf von .+ bis zum Stichtag$/ })
			.first()
	).toBeVisible();
});
