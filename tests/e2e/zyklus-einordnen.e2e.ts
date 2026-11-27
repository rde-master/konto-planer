import { expect, test, type Page } from '@playwright/test';

// "Immer so einordnen": a category rule made at a booking – for its payee, for the bookings
// without category that are there, and for new ones. Uses the account of zyklus-doppelt.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Doppelkonto';
const PAYEE = 'Tierbedarf Krause';

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function book(page: Page, payee: string, amount: string, category?: string) {
	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill(amount);
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	if (category)
		await sheet.getByLabel('Kategorie', { exact: true }).selectOption({ label: category });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(payee);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
}

/** The booking in the list with this payee and amount. */
async function row(page: Page, payee: string, amount: string) {
	await page.goto(`/buchungen?q=${encodeURIComponent(PAYEE)}`);
	return page.getByRole('main').getByRole('link', { name: new RegExp(`${payee}.*${amount}`) });
}

test('a rule from a booking categorises the payee’s bookings without category', async ({
	page
}) => {
	await login(page);
	await book(page, `${PAYEE} 4711`, '20');
	await book(page, `${PAYEE} 0815`, '15');
	await book(page, `${PAYEE} 2222`, '9', 'Drogerie');
	await expect(await row(page, `${PAYEE} 4711`, '20,00')).toContainText('Ohne Kategorie');

	await (await row(page, `${PAYEE} 4711`, '20,00')).click();
	await page.getByRole('button', { name: 'Immer so einordnen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Immer so einordnen' });
	// The proposal leaves out the number that changes from booking to booking.
	await expect(sheet.getByLabel('Text Empfänger/Zahler')).toHaveValue(PAYEE);
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet.getByText('Bitte eine Kategorie wählen.')).toBeVisible();
	// A text the booking does not contain would never match it.
	await sheet.getByLabel('Kategorie', { exact: true }).selectOption({ label: 'Supermarkt' });
	await sheet.getByLabel('Text Empfänger/Zahler').fill('Zoohandlung');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet.getByText(/kommt in der Buchung nicht vor/)).toBeVisible();
	await sheet.getByLabel('Text Empfänger/Zahler').fill(PAYEE);
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toContainText(
		`Empfänger/Zahler enthält „${PAYEE}“ → Lebensmittel › Supermarkt`
	);
	await expect(page.getByRole('status')).toContainText(
		'Eine weitere Buchung ohne Kategorie wurde eingeordnet.'
	);

	// Both bookings without category have it; the one with another category keeps hers.
	await expect(await row(page, `${PAYEE} 4711`, '20,00')).toContainText('Supermarkt');
	await expect(await row(page, `${PAYEE} 0815`, '15,00')).toContainText('Supermarkt');
	await expect(await row(page, `${PAYEE} 2222`, '9,00')).toContainText('Drogerie');

	// The rule is an ordinary category rule, first in the list.
	await page.goto('/kategorien/regeln');
	await expect(
		page.getByRole('region', { name: 'Regeln' }).getByRole('listitem').first()
	).toContainText(`Empfänger/Zahler enthält „${PAYEE}“`);
});

test('a new booking without category gets the payee’s category', async ({ page }) => {
	await login(page);
	await book(page, `${PAYEE} 9999`, '31');
	await expect(await row(page, `${PAYEE} 9999`, '31,00')).toContainText('Supermarkt');
	// A category chosen by hand stays.
	await book(page, `${PAYEE} 3333`, '4', 'Drogerie');
	await expect(await row(page, `${PAYEE} 3333`, '4,00')).toContainText('Drogerie');

	// Saving the same rule with another category changes the rule, not the bookings.
	await (await row(page, `${PAYEE} 9999`, '31,00')).click();
	await page.getByRole('button', { name: 'Immer so einordnen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Immer so einordnen' });
	await sheet.getByLabel('Kategorie', { exact: true }).selectOption({ label: 'Drogerie' });
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toContainText('Keine weitere Buchung ohne Kategorie');
	await expect(await row(page, `${PAYEE} 9999`, '31,00')).toContainText('Drogerie');
	await expect(await row(page, `${PAYEE} 4711`, '20,00')).toContainText('Supermarkt');
	await page.goto('/kategorien/regeln');
	await expect(page.getByRole('main').getByText(`„${PAYEE}“`)).toHaveCount(1);
});
