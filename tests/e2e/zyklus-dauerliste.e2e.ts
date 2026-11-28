import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// The list of recurring items: search, filter, order, the marks of a row – and an item
// without a category takes the category of its booking.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Listenkonto';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function createItem(
	page: Page,
	o: { name: string; amount: string; interval?: string; category?: string; income?: boolean }
) {
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	if (o.income) await sheet.getByText('Einnahme', { exact: true }).click();
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill(o.name);
	await sheet.getByLabel('Betrag in €').fill(o.amount);
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	if (o.category) await sheet.getByLabel('Kategorie').selectOption({ label: o.category });
	if (o.interval) await sheet.getByLabel('Intervall').selectOption({ label: o.interval });
	// In the future: nothing is booked provisionally yet.
	await sheet.getByLabel('Erste Fälligkeit').fill(addDays(today, 5));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

const section = (page: Page) => page.getByRole('region', { name: ACCOUNT });
const rows = (page: Page) => section(page).getByRole('listitem');

test('the list is searched, filtered and ordered; rows show rhythm and category', async ({
	page
}) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('2.000');
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await createItem(page, { name: 'Listenfilm', amount: '13,99', category: 'Abos und Streaming' });
	await createItem(page, { name: 'Listenfunk', amount: '55,08', interval: 'Vierteljährlich' });
	await createItem(page, { name: 'Listenlohn', amount: '2.100', income: true });

	// One plus on the phone: the round one creates an item here.
	await page.goto('/dauerposten');
	await expect(page.getByRole('button', { name: 'Dauerposten anlegen' })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Schnellerfassung' })).toHaveCount(0);

	// Marks of a row: the rhythm in its colour, the category with its dot.
	const film = rows(page).filter({ hasText: 'Listenfilm' });
	await expect(film.locator('[data-interval="monthly"]')).toHaveText('monatlich');
	await expect(film.locator('[data-category]')).toContainText('Abos und Streaming');
	await expect(film.locator('[data-category-dots]')).toHaveCount(1);
	const funk = rows(page).filter({ hasText: 'Listenfunk' });
	await expect(funk.locator('[data-interval="quarterly"]')).toHaveText('vierteljährlich');
	await expect(funk.locator('[data-category-dots]')).toHaveCount(0);
	const colors = await Promise.all(
		[film, funk].map((r) =>
			r.locator('[data-interval]').evaluate((e) => getComputedStyle(e).backgroundColor)
		)
	);
	expect(colors[0]).not.toBe(colors[1]);

	// Search: filters while typing and lands in the address.
	await page.getByLabel('Dauerposten suchen').fill('listenf');
	await expect(rows(page)).toHaveCount(2);
	await expect(page).toHaveURL(/q=listenf/);
	await expect(page.getByRole('status').filter({ hasText: 'Dauerposten –' })).toContainText(
		/^\s*2 von \d+ Dauerposten/
	);

	// Filter by rhythm, and what the filter leaves is summed up.
	await page.getByLabel('Nach Rhythmus filtern').selectOption({ label: 'vierteljährlich' });
	await expect(rows(page)).toHaveCount(1);
	await expect(rows(page)).toContainText('Listenfunk');
	await expect(section(page)).toContainText(/Ausgaben 18,36\s€/);

	// The filter survives a visit to the item.
	await rows(page).getByRole('link').click();
	await expect(page.getByRole('heading', { level: 1, name: 'Listenfunk' })).toBeVisible();
	await page.locator('main header').getByRole('link').click();
	await expect(page).toHaveURL(/rhythmus=quarterly/);
	await expect(rows(page)).toHaveCount(1);

	await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
	await expect(page).toHaveURL(/\/dauerposten$/);
	await expect(page.getByLabel('Dauerposten suchen')).toHaveValue('');
	await expect(rows(page)).toHaveCount(3);

	// Kind and category.
	await page.getByLabel('Nach Art filtern').selectOption({ label: 'Einnahmen' });
	await expect(rows(page)).toHaveCount(1);
	await expect(rows(page)).toContainText('Listenlohn');
	await page.getByLabel('Nach Art filtern').selectOption({ label: 'Alle Arten' });
	await page.getByLabel('Nach Kategorie filtern').selectOption({ label: 'Freizeit' });
	await expect(rows(page)).toHaveCount(1);
	await expect(rows(page)).toContainText('Listenfilm');
	await page.getByLabel('Nach Kategorie filtern').selectOption({ label: 'Alle Kategorien' });

	// Order: by amount the salary leads, by name the film.
	await page.getByLabel('Sortieren nach').selectOption({ label: 'Sortiert: Betrag' });
	await expect(page).toHaveURL(/sortierung=betrag/);
	await expect(rows(page).first()).toContainText('Listenlohn');
	await expect(rows(page).last()).toContainText('Listenfilm');
	await page.getByLabel('Sortieren nach').selectOption({ label: 'Sortiert: Name' });
	await expect(rows(page).first()).toContainText('Listenfilm');
	await expect(rows(page).last()).toContainText('Listenlohn');

	// Nothing fits: the way back is offered.
	await page.getByLabel('Dauerposten suchen').fill('gibtesnicht');
	await expect(page.getByText('Kein Dauerposten passt')).toBeVisible();
	await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
	await expect(rows(page)).toHaveCount(3);
});

test('an item without a category takes the category of its booking', async ({ page }) => {
	await login(page);
	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('55,08');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Kategorie').selectOption({ label: 'Supermarkt' });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill('Funkhaus Listen');
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	await page.goto('/buchungen?q=Funkhaus');
	await page
		.getByRole('main')
		.getByRole('link', { name: /Funkhaus Listen.*55,08/ })
		.click();
	await page.getByRole('button', { name: 'Dauerposten zuordnen' }).click();
	const assign = page.getByRole('dialog', { name: 'Dauerposten zuordnen' });
	await assign.getByLabel('Dauerposten').selectOption({ label: 'Listenfunk' });
	await assign.getByRole('button', { name: 'Zuordnen' }).click();
	await expect(assign).toBeHidden();

	// The list knows the category now – with its dot, and in the filter.
	await page.goto('/dauerposten?q=listenfunk');
	const funk = rows(page).filter({ hasText: 'Listenfunk' });
	await expect(funk.locator('[data-category]')).toContainText('Supermarkt');
	await expect(funk.locator('[data-category-dots]')).toHaveCount(1);
	// It is entered at the item itself.
	await funk.getByRole('link').click();
	await expect(page.getByRole('main')).toContainText('Supermarkt');

	// An item that has a category keeps it, whatever its bookings say.
	await page.goto('/dauerposten?q=listenfilm');
	await expect(rows(page).locator('[data-category]')).toContainText('Abos und Streaming');
});
