import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { todayBerlin } from '../../src/lib/dates';

// Transfers between two accounts made by hand. Uses giro account and card of zyklus-kreditkarte.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const GIRO = 'Abrechnungskonto Karte';
const CARD = 'Musterkarte';
const SAVINGS = 'Notgroschen Test';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openAccount(page: Page, name: string) {
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(name) }).click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

const balance = (page: Page) => page.getByLabel('Kontostand', { exact: true });

/** Bookings in the list with this text and amount (the amount keeps the filter chip out). */
async function found(page: Page, text: string, amount: string) {
	await page.goto(`/buchungen?q=${encodeURIComponent(text)}`);
	return page.getByRole('main').getByRole('link', { name: new RegExp(`${text}.*${amount}`) });
}

async function book(
	page: Page,
	o: { amount: string; account: string; payee: string; income?: boolean; transferWith?: string }
) {
	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	if (o.income) await sheet.getByText('Einnahme', { exact: true }).click();
	await sheet.getByLabel('Betrag in €').fill(o.amount);
	await sheet.getByLabel('Konto').selectOption({ label: o.account });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(o.payee);
	if (o.transferWith)
		await sheet.getByLabel('Umbuchung auf/von').selectOption({ label: o.transferWith });
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
}

test('a new booking is entered as a transfer; releasing removes the other side', async ({
	page
}) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByText('Sparbuch', { exact: true }).click();
	await account.getByLabel('Name').fill(SAVINGS);
	await account.getByLabel('Betrag in €').fill('0');
	await account.getByLabel('Stand am').fill(today);
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await openAccount(page, GIRO);
	const before = (await balance(page).textContent()) ?? '';

	await book(page, { amount: '200', account: GIRO, payee: 'Rücklage Test', transferWith: SAVINGS });
	await expect(page.getByRole('status')).toContainText(
		`Umbuchung auf ${SAVINGS.toLowerCase()}: Gegenbuchung angelegt.`
	);

	// Out of the giro account, into the savings account.
	await openAccount(page, SAVINGS);
	await expect(balance(page)).toHaveText(/200,00\s€/);
	await openAccount(page, GIRO);
	await expect(balance(page)).not.toHaveText(before);

	// Both sides know each other.
	await (await found(page, 'Rücklage Test', '200,00')).click();
	await openTab(page, 'Aktionen');
	await expect(page.getByRole('button', { name: 'Als Umbuchung kennzeichnen' })).toHaveCount(0);
	await openTab(page, 'Buchung');
	await page.getByRole('link', { name: new RegExp(`Umbuchung.*Auf ${SAVINGS}`) }).click();
	await expect(page.getByRole('heading', { level: 1, name: GIRO })).toBeVisible();
	await expect(
		page.getByRole('link', { name: new RegExp(`Umbuchung.*Von ${GIRO}`) })
	).toBeVisible();

	// Changing the amount moves the other side along.
	await (await found(page, 'Rücklage Test', '200,00')).click();
	const edit = page.locator('form[action="?/update"]');
	await edit.getByLabel('Betrag in €').fill('250');
	await edit.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toContainText('Änderungen gesichert.');
	await openAccount(page, SAVINGS);
	await expect(balance(page)).toHaveText(/250,00\s€/);

	// Released: the booking the app created goes to the trash.
	await (await found(page, 'Rücklage Test', '250,00')).click();
	await openTab(page, 'Aktionen');
	await page.getByRole('button', { name: 'Umbuchung auflösen' }).click();
	const release = page.getByRole('dialog', { name: 'Umbuchung auflösen' });
	await expect(release.getByLabel(`Buchung auf ${SAVINGS} löschen`)).toBeChecked();
	await release.getByRole('button', { name: 'Auflösen' }).click();
	await expect(release).toBeHidden();
	await expect(page.getByRole('status')).toContainText(
		`Die Gegenbuchung auf ${SAVINGS} liegt im Papierkorb.`
	);
	await expect(page.getByRole('button', { name: 'Als Umbuchung kennzeichnen' })).toBeVisible();
	await openAccount(page, SAVINGS);
	await expect(balance(page)).toHaveText(/0,00\s€/);
});

test('two existing bookings are linked instead of creating a third', async ({ page }) => {
	await login(page);
	await book(page, { amount: '75', account: GIRO, payee: 'Übertrag Test' });
	await book(page, { amount: '75', account: CARD, payee: 'Übertrag Test', income: true });
	await expect(await found(page, 'Übertrag Test', '75,00')).toHaveCount(2);

	await (await found(page, 'Übertrag Test', '−75,00')).click();
	await openTab(page, 'Aktionen');
	await page.getByRole('button', { name: 'Als Umbuchung kennzeichnen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Umbuchung' });
	await sheet.getByLabel('Umbuchung auf').selectOption({ label: CARD });
	await sheet.getByRole('button', { name: 'Kennzeichnen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toContainText(
		`Verknüpft mit der passenden Buchung auf ${CARD}.`
	);
	await openTab(page, 'Buchung');
	await expect(
		page.getByRole('link', { name: new RegExp(`Umbuchung.*Auf ${CARD}`) })
	).toBeVisible();
	await expect(await found(page, 'Übertrag Test', '75,00')).toHaveCount(2);

	// Transfers count neither as expense nor as income.
	await (await found(page, 'Übertrag Test', '−75,00')).click();
	await openTab(page, 'Aktionen');
	await page.getByRole('button', { name: 'Umbuchung auflösen' }).click();
	const release = page.getByRole('dialog', { name: 'Umbuchung auflösen' });
	await release.getByLabel(`Buchung auf ${CARD} löschen`).uncheck();
	await release.getByRole('button', { name: 'Auflösen' }).click();
	await expect(release).toBeHidden();
	await expect(page.getByRole('status')).toContainText(`Die Buchung auf ${CARD} bleibt stehen.`);
	await expect(await found(page, 'Übertrag Test', '75,00')).toHaveCount(2);
});
