import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';
import { debitDateFor, statementDates } from '../../src/lib/credit-card';
import { monthName } from '../../src/lib/monthly-report';

// "Monatsübersicht" on the account page: the sum of everything that left the account per month.
// Uses the giro account of zyklus-kreditkarte (one card statement of 100 € was debited).
const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const GIRO = 'Abrechnungskonto Karte';
const today = todayBerlin();
const opening = addDays(today, -34);
const statementDay = Number(addDays(today, -10).slice(8));
const debitDay = Number(addDays(today, -5).slice(8));
const last = statementDates(statementDay, opening, today).at(-1)!;
const debit = debitDateFor(last, debitDay);

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('the account page sums up what left the account in each month', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(GIRO) }).click();
	await expect(page.getByRole('heading', { level: 1, name: GIRO })).toBeVisible();

	const months = page.getByRole('region', { name: 'Monatsübersicht' });
	// From the month the account was opened in up to the running one.
	await expect(months.getByRole('link').first()).toContainText('bisher');
	await expect(months.getByRole('link').last()).toContainText(monthName(opening.slice(0, 7)));

	// The card statement left the account: it counts, and is named as a transfer.
	const month = months.getByRole('link', {
		name: new RegExp(`${monthName(debit.slice(0, 7))}: Abbuchungen −100,00\\s€`)
	});
	await expect(month).toContainText('1 Abbuchung');
	await expect(month).toContainText(/umgebucht −100,00\s€/);

	// A tap shows the bookings behind the sum.
	await month.click();
	await expect(page).toHaveURL(new RegExp(`von=${debit.slice(0, 7)}-01.*richtung=out`));
	await expect(page.getByRole('main')).toContainText(/1 Buchung · Summe −100,00\s€/);
	await expect(page.locator('main header').getByRole('link')).toHaveText(GIRO);
});
