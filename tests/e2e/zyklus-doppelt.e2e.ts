import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// A recurring item created after its payment is on the account must not book the payment a
// second time: the real booking takes the place of the provisional one.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Doppelkonto';
const PAYEE = 'APPLE.COM BILL CORK';
const ITEM = 'Wolkenspeicher';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

/** Bookings in the list with this text and amount (the amount keeps the filter chip out). */
async function found(page: Page, text: string, amount: string) {
	await page.goto(`/buchungen?q=${encodeURIComponent(text)}`);
	return page.getByRole('main').getByRole('link', { name: new RegExp(`${text}.*${amount}`) });
}

test('the payment that is there already counts for the new recurring item', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('100');
	await account.getByLabel('Stand am').fill(addDays(today, -10));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	// The real payment, under the name the bank gives it.
	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('3,49');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(PAYEE);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	// The recurring item is created by hand afterwards, under another name.
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const create = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await create.getByLabel('Bezeichnung').fill(ITEM);
	await create.getByLabel('Betrag in €').fill('3,49');
	await create.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await create.getByLabel('Erste Fälligkeit').fill(addDays(today, -3));
	await create.getByRole('button', { name: 'Anlegen' }).click();
	await expect(create).toBeHidden();

	// Not twice: no provisional booking, the payment belongs to the item.
	await expect(await found(page, ITEM, '3,49')).toHaveCount(0);
	await (await found(page, PAYEE, '3,49')).click();
	await expect(page.getByRole('link', { name: new RegExp(`Dauerposten.*${ITEM}`) })).toBeVisible();
	await page.goto('/konten');
	await expect(page.getByRole('link', { name: new RegExp(ACCOUNT) })).toContainText('96,51');
});

test('a payment released by hand is not taken again', async ({ page }) => {
	await login(page);
	await (await found(page, PAYEE, '3,49')).click();
	await page.getByRole('button', { name: 'Zuordnung lösen' }).click();
	const release = page.getByRole('dialog', { name: 'Zuordnung lösen' });
	await release.getByRole('button', { name: 'Lösen' }).click();
	await expect(release).toBeHidden();
	await expect(page.getByRole('button', { name: 'Dauerposten zuordnen' })).toBeVisible();

	// The due date is open again and stays so – also after the item is saved once more.
	await expect(await found(page, ITEM, '3,49')).toHaveCount(1);
	await page.goto('/dauerposten');
	await page.getByRole('link', { name: new RegExp(ITEM) }).click();
	await page.locator('form[action="?/update"]').getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toBeVisible();
	await expect(await found(page, ITEM, '3,49')).toHaveCount(1);
	await (await found(page, PAYEE, '3,49')).click();
	await expect(page.getByRole('button', { name: 'Dauerposten zuordnen' })).toBeVisible();
});

test('the list marks payments of recurring items and shows the colour of the category', async ({
	page
}) => {
	await login(page);
	// The provisional booking of the item: tinted and named; no category, so no dot.
	const provisional = await found(page, ITEM, '3,49');
	await expect(provisional).toContainText('Dauerposten');
	await expect(provisional).toHaveClass(/bg-accent/);
	await expect(provisional.locator('[data-category-dots]')).toHaveCount(0);
	// Not confirmed by the bank yet: a question mark at the icon, the word in its own colour.
	await expect(provisional.locator('[data-provisional-mark]')).toHaveText('?');
	await expect(provisional.getByText('vorläufig', { exact: true })).toHaveClass(
		/text-provisional-text/
	);

	// A booking without item is a plain row; with a category it gets its dot.
	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('8,20');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Kategorie').selectOption({ label: 'Supermarkt' });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill('Markt Punktfarbe');
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
	const plain = await found(page, 'Markt Punktfarbe', '8,20');
	await expect(plain).not.toContainText('Dauerposten');
	await expect(plain).not.toHaveClass(/bg-accent/);
	await expect(plain.locator('[data-category-dots] > span')).toHaveCount(1);
	await expect(plain.locator('[data-provisional-mark]')).toHaveCount(0);
	await expect(plain).not.toContainText('vorläufig');
	const free = await found(page, PAYEE, '3,49');
	await expect(free.locator('[data-category-dots]')).toHaveCount(0);

	// Assigned to the item, the real payment is marked and names the item.
	await free.click();
	await page.getByRole('button', { name: 'Dauerposten zuordnen' }).click();
	const assign = page.getByRole('dialog', { name: 'Dauerposten zuordnen' });
	await assign.getByLabel('Dauerposten').selectOption({ label: ITEM });
	await assign.getByRole('button', { name: 'Zuordnen' }).click();
	await expect(assign).toBeHidden();
	const paid = await found(page, PAYEE, '3,49');
	await expect(paid).toContainText(`Dauerposten ${ITEM}`);
	await expect(paid).toHaveClass(/bg-accent/);
});
