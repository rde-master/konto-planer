import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// A recurring item has an alternative name: its bookings show it instead of the payee's name,
// and a switch on the pages with bookings turns that off and on again.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Namenskonto';
const ITEM = 'Mobilfunk Namen';
const PAYEE = 'FUNKNETZ NAMEN GMBH';
const ALT = 'Handy Lisa';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

const toggle = (page: Page) =>
	page.getByRole('main').getByRole('switch', { name: /Alternative Bezeichnungen/ });

/** Bookings of the account in the list whose row starts with this title. */
async function rows(page: Page, accountId: string, title: string) {
	await page.goto(`/buchungen?konto=${accountId}`);
	await expect(page.getByRole('heading', { level: 1, name: 'Buchungen' })).toBeVisible();
	return page.getByRole('main').getByRole('link', { name: new RegExp(`${title}.*29,99`) });
}

let accountId = '';

test('bookings of an item show its alternative name; the switch brings the payee back', async ({
	page
}) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByLabel('Name').fill(ACCOUNT);
	await sheet.getByLabel('Betrag in €').fill('500');
	await sheet.getByLabel('Stand am').fill(addDays(today, -40));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await expect(page.getByRole('heading', { level: 1, name: ACCOUNT })).toBeVisible();
	accountId = new URL(page.url()).pathname.split('/').at(-1)!;

	// The due date lies some days back: it is booked provisionally at once.
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const create = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await create.getByLabel('Bezeichnung', { exact: true }).fill(ITEM);
	await create.getByLabel('Alternative Bezeichnung').fill(ALT);
	await create.getByLabel('Betrag in €').fill('29,99');
	await create.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await create.getByLabel('Erste Fälligkeit').fill(addDays(today, -10));
	await create.getByLabel('Empfänger (optional)').fill(PAYEE);
	await create.getByRole('button', { name: 'Anlegen' }).click();
	await expect(create).toBeHidden();

	// The list shows the alternative name; the item's own name stands in the line below.
	const own = await rows(page, accountId, ALT);
	await expect(own).toHaveCount(1);
	await expect(own).toContainText(`Dauerposten ${ITEM}`);
	await expect(page.getByRole('main').getByText(PAYEE)).toHaveCount(0);
	await expect(toggle(page)).toBeChecked();

	// The search finds the booking by what the list shows.
	await page.goto(`/buchungen?q=${encodeURIComponent(ALT)}`);
	await expect(
		page.getByRole('main').getByRole('link', { name: new RegExp(`${ALT}.*29,99`) })
	).toHaveCount(1);

	// Switched off: the payee as the bank writes it.
	await page.goto(`/buchungen?konto=${accountId}`);
	await toggle(page).uncheck();
	const bank = page.getByRole('main').getByRole('link', { name: new RegExp(`${PAYEE}.*29,99`) });
	await expect(bank).toHaveCount(1);
	await expect(
		page.getByRole('main').getByRole('link', { name: new RegExp(`^${ALT}`) })
	).toHaveCount(0);

	// The choice is remembered and holds on the booking's own page, too.
	await page.reload();
	await expect(toggle(page)).not.toBeChecked();
	await bank.click();
	await expect(page.getByRole('heading', { level: 1, name: PAYEE })).toBeVisible();
	await toggle(page).check();
	await expect(page.getByRole('heading', { level: 1, name: ALT })).toBeVisible();
	await expect(await rows(page, accountId, ALT)).toHaveCount(1);
});

test('the recurring items show the alternative name; without one there is nothing to switch', async ({
	page
}) => {
	await login(page);
	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('3,20');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill('Kiosk Namen');
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	await page.goto(`/buchungen?konto=${accountId}`);
	await page
		.getByRole('main')
		.getByRole('link', { name: /Kiosk Namen.*3,20/ })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Kiosk Namen' })).toBeVisible();
	await expect(toggle(page)).toHaveCount(0);

	// The list of recurring items shows the alternative name, too – with its own switch.
	await page.goto('/dauerposten');
	const items = page.getByRole('region', { name: ACCOUNT });
	await expect(items.getByRole('link', { name: new RegExp(`^${ALT}.*${ITEM}`) })).toHaveCount(1);
	await toggle(page).uncheck();
	await expect(items.getByRole('link', { name: new RegExp(`^${ITEM}`) })).toHaveCount(1);
	await expect(items.getByText(ALT)).toHaveCount(0);
	await toggle(page).check();
	await items.getByRole('link', { name: new RegExp(`^${ALT}`) }).click();
	// The item's own page is titled the same way.
	await expect(page.getByRole('heading', { level: 1, name: ALT })).toBeVisible();
	await toggle(page).uncheck();
	await expect(page.getByRole('heading', { level: 1, name: ITEM })).toBeVisible();
	await toggle(page).check();
	await expect(page.getByRole('heading', { level: 1, name: ALT })).toBeVisible();

	// Taking the alternative name away brings the item's payee back in the list.
	await openTab(page, 'Bearbeiten');
	await page.getByRole('main').getByRole('textbox', { name: 'Alternative Bezeichnung' }).fill('');
	await page.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByText('Änderungen gesichert.')).toBeVisible();
	await expect(await rows(page, accountId, PAYEE)).toHaveCount(1);
});
