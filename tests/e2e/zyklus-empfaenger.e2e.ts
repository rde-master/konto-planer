import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// "Auswertungen › Empfänger": what was paid to whom in a period; payees that are the same
// company under several names are put together.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Empfangskonto';
const WORKS = 'Stadtwerke Empfang GmbH';
const ENERGY = 'SWE Energie Empfang';
const BOOKS = 'Buchladen Empfang';
const today = todayBerlin();

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
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(payee);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
}

const report = (page: Page) => page.getByRole('region', { name: 'Zahlungen nach Empfänger' });
const row = (page: Page, name: string) => report(page).getByRole('listitem', { name, exact: true });
const total = (page: Page) => report(page).getByLabel('Gezahlt gesamt');

test('payments per payee in a period, with payees put together', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByLabel('Name').fill(ACCOUNT);
	await sheet.getByLabel('Betrag in €').fill('1.000');
	await sheet.getByLabel('Stand am').fill(addDays(today, -40));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await expect(page.getByRole('heading', { level: 1, name: ACCOUNT })).toBeVisible();
	const accountId = new URL(page.url()).pathname.split('/').at(-1)!;

	await book(page, WORKS, '40');
	await book(page, ENERGY, '42');
	await book(page, BOOKS, '15');
	await book(page, BOOKS, '5,50');

	// The report of this month: one row per payee, largest first.
	const month = `${today.slice(0, 7)}-01`;
	await page.goto(`/auswertungen?ansicht=empfaenger&konto=${accountId}&von=${month}&bis=${today}`);
	await expect(report(page).getByRole('heading')).toContainText('3 Empfänger');
	await expect(total(page)).toHaveText(/102,50\s€/);
	await expect(row(page, ENERGY)).toContainText(/42,00\s€/);
	await expect(row(page, WORKS)).toContainText(/40,00\s€/);
	await expect(row(page, BOOKS)).toContainText(/20,50\s€/);
	await expect(row(page, BOOKS)).toContainText('2 Zahlungen');
	const order = await report(page)
		.locator('ul > li[aria-label]')
		.evaluateAll((items) => items.map((li) => li.getAttribute('aria-label')));
	expect(order).toEqual([ENERGY, WORKS, BOOKS]);

	// Another period, and back.
	await page
		.getByRole('navigation', { name: 'Zeitraum' })
		.getByRole('link', { name: 'Letztes Jahr' })
		.click();
	await expect(report(page)).toContainText('Keine Zahlungen in diesem Zeitraum.');
	await page
		.getByRole('navigation', { name: 'Zeitraum' })
		.getByRole('link', { name: 'Dieser Monat' })
		.click();
	await expect(total(page)).toHaveText(/102,50\s€/);
	await expect(page).toHaveURL(new RegExp(`konto=${accountId}`));

	// Searching narrows the list and the sum.
	await page.getByLabel('Empfänger suchen').fill('buch');
	await expect(report(page).getByRole('heading')).toContainText('1 Empfänger');
	await expect(total(page)).toHaveText(/20,50\s€/);
	await page.getByLabel('Empfänger suchen').fill('');

	// The utility debits under two names: they count as one from now on.
	await page.getByRole('button', { name: 'Zusammenfassen' }).click();
	const pick = page.getByRole('group', { name: 'Auswahl' });
	await expect(pick.getByRole('button', { name: 'Als einen zählen' })).toBeDisabled();
	await page.getByLabel(`${ENERGY} auswählen`).check();
	await page.getByLabel(`${WORKS} auswählen`).check();
	await expect(pick).toContainText('2 ausgewählt');
	await pick.getByRole('button', { name: 'Als einen zählen' }).click();
	const merge = page.getByRole('dialog', { name: 'Zusammenfassen' });
	await expect(merge.getByLabel('Name des Empfängers')).toHaveValue(ENERGY);
	await merge.getByLabel('Name des Empfängers').fill('Stadtwerke Empfang');
	await merge.getByRole('button', { name: 'Sichern' }).click();
	await expect(merge).toBeHidden();
	await expect(page.getByRole('status')).toHaveText(
		'„Stadtwerke Empfang“ fasst jetzt 2 Namen zusammen.'
	);
	await expect(report(page).getByRole('heading')).toContainText('2 Empfänger');
	await expect(total(page)).toHaveText(/102,50\s€/);
	const group = row(page, 'Stadtwerke Empfang');
	await expect(group).toContainText(/82,00\s€/);
	await expect(group).toContainText('2 Namen · 2 Zahlungen');

	// The names behind it, each with its payments in the booking list.
	await group.locator('summary').click();
	await expect(group.getByRole('listitem', { name: ENERGY })).toContainText(/42,00\s€/);
	await group.getByRole('listitem', { name: WORKS }).getByRole('link').click();
	await expect(page).toHaveURL(/\/buchungen\?/);
	await expect(
		page.getByRole('main').getByRole('link', { name: new RegExp(`${WORKS}.*40,00`) })
	).toHaveCount(1);
	await page.goBack();

	await row(page, 'Stadtwerke Empfang').locator('summary').click();
	await row(page, 'Stadtwerke Empfang').getByRole('button', { name: 'Umbenennen' }).click();
	const rename = page.getByRole('dialog', { name: 'Umbenennen' });
	await rename.getByLabel('Name des Empfängers').fill('Stadtwerke E.');
	await rename.getByRole('button', { name: 'Sichern' }).click();
	await expect(rename).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Umbenannt in „Stadtwerke E.“.');

	// A third name joins the group by the group's name.
	await page.getByRole('button', { name: 'Zusammenfassen' }).click();
	await page.getByLabel(`${BOOKS} auswählen`).check();
	await page.getByLabel('Stadtwerke E. auswählen').check();
	await page
		.getByRole('group', { name: 'Auswahl' })
		.getByRole('button', { name: 'Als einen zählen' })
		.click();
	await expect(merge.getByLabel('Name des Empfängers')).toHaveValue('Stadtwerke E.');
	await merge.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toHaveText(
		'„Stadtwerke E.“ fasst jetzt 3 Namen zusammen.'
	);
	await expect(report(page).getByRole('heading')).toContainText('1 Empfänger');

	// One name out again, then the whole group.
	await row(page, 'Stadtwerke E.').locator('summary').click();
	await page.getByRole('button', { name: `${BOOKS} herauslösen` }).click();
	await expect(page.getByRole('status')).toHaveText('Name aus „Stadtwerke E.“ herausgelöst.');
	await expect(row(page, BOOKS)).toContainText(/20,50\s€/);
	await expect(row(page, 'Stadtwerke E.')).toContainText(/82,00\s€/);
	// The group stays open.
	await page.getByRole('button', { name: 'Zusammenfassung auflösen' }).click();
	await expect(page.getByRole('status')).toHaveText('Zusammenfassung „Stadtwerke E.“ aufgelöst.');
	await expect(report(page).getByRole('heading')).toContainText('3 Empfänger');
	await expect(row(page, WORKS)).toContainText(/40,00\s€/);

	// Nothing sticks out on the phone.
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});
