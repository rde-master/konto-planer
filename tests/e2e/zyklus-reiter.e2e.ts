import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Long pages are split into tabs ("Reiter"); a recurring item lists its bookings in one of them.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Reiterkonto';
const ITEM = 'Zeitschrift Reiter';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

const selected = (page: Page) => page.getByRole('tab', { selected: true });

test('a recurring item shows its parts in tabs, the bookings among them', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('300');
	await account.getByLabel('Stand am').fill(addDays(today, -40));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	// The due date lies some days back: it is booked provisionally at once.
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const create = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await create.getByLabel('Bezeichnung', { exact: true }).fill(ITEM);
	await create.getByLabel('Betrag in €').fill('6,50');
	await create.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await create.getByLabel('Erste Fälligkeit').fill(addDays(today, -10));
	await create.getByRole('button', { name: 'Anlegen' }).click();
	await expect(create).toBeHidden();

	await page
		.getByRole('region', { name: ACCOUNT })
		.getByRole('link', { name: new RegExp(ITEM) })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: ITEM })).toBeVisible();

	// The overview comes first; the other parts wait behind their tabs.
	await expect(page.getByRole('tablist', { name: 'Bereich' }).getByRole('tab')).toHaveText([
		'Übersicht',
		'Buchungen',
		'Betrag',
		'Bearbeiten',
		'Mehr'
	]);
	await expect(selected(page)).toHaveText('Übersicht');
	await expect(page.getByRole('region', { name: 'Nächste Fälligkeiten' })).toBeVisible();
	await expect(page.getByRole('list', { name: 'Betragsverlauf' })).toHaveCount(0);
	await expect(page.getByLabel('Bezeichnung', { exact: true })).toHaveCount(0);

	// The bookings of the item: the provisional one of the due date that has come.
	await openTab(page, 'Buchungen');
	await expect(page.getByRole('region', { name: 'Nächste Fälligkeiten' })).toHaveCount(0);
	const bookings = page.getByRole('region', { name: 'Buchungen', exact: true });
	await expect(bookings.getByRole('heading')).toContainText('1 Buchung');
	await expect(bookings.getByLabel('Summe der Buchungen')).toHaveText(/−6,50\s€/);
	const row = bookings.getByRole('link');
	await expect(row).toHaveCount(1);
	await expect(row).toContainText('vorläufig');
	await expect(row).toContainText(ACCOUNT);
	await expect(row).toContainText(/−6,50\s€/);

	// From the booking back to the item: the tab is still the one left.
	await row.click();
	await expect(page.getByText('Vorläufig aus Dauerposten')).toBeVisible();
	await page.goBack();
	await expect(page.getByRole('heading', { level: 1, name: ITEM })).toBeVisible();
	await expect(selected(page)).toHaveText('Buchungen');

	// The arrow keys move between the tabs.
	await selected(page).press('ArrowRight');
	await expect(selected(page)).toHaveText('Betrag');
	await expect(page.getByRole('list', { name: 'Betragsverlauf' })).toBeVisible();
	await selected(page).press('End');
	await expect(selected(page)).toHaveText('Mehr');

	// Saving keeps the tab; a new visit starts with the overview again.
	await openTab(page, 'Bearbeiten');
	await page.getByLabel('Notiz (optional)').fill('erscheint monatlich');
	await page.getByRole('button', { name: 'Sichern', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');
	await expect(selected(page)).toHaveText('Bearbeiten');
	await page.goto('/dauerposten');
	await page
		.getByRole('region', { name: ACCOUNT })
		.getByRole('link', { name: new RegExp(ITEM) })
		.click();
	await expect(selected(page)).toHaveText('Übersicht');
});

test('the account and the booking show their parts in tabs, too', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await expect(page.getByRole('heading', { level: 1, name: ACCOUNT })).toBeVisible();
	const tabs = page.getByRole('tablist', { name: 'Bereich' }).getByRole('tab');
	await expect(tabs).toHaveText(['Übersicht', 'Verlauf', 'Bearbeiten']);
	// What is used daily stays on the first tab.
	await expect(page.getByRole('link', { name: 'CSV importieren' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Monatsübersicht' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Archivieren' })).toHaveCount(0);
	await openTab(page, 'Verlauf');
	await expect(page.getByRole('region', { name: 'Monatsübersicht' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'CSV importieren' })).toHaveCount(0);
	await openTab(page, 'Bearbeiten');
	await expect(page.getByRole('button', { name: 'Archivieren' })).toBeVisible();

	// The booking: what it belongs to stands with the booking, the actions behind their tab.
	await page.goto(`/buchungen?q=${encodeURIComponent(ITEM)}`);
	await page
		.getByRole('main')
		.getByRole('link', { name: new RegExp(`${ITEM}.*6,50`) })
		.click();
	await expect(tabs).toHaveText(['Buchung', 'Einordnen', 'Aktionen']);
	const itemLink = page
		.getByRole('main')
		.getByRole('link', { name: new RegExp(`Dauerposten.*${ITEM}`) });
	await expect(itemLink).toBeVisible();
	await expect(page.getByRole('button', { name: 'Als Vorlage sichern' })).toHaveCount(0);
	await openTab(page, 'Einordnen');
	await expect(page.getByRole('region', { name: 'Tags' })).toBeVisible();
	await expect(itemLink).toHaveCount(0);
	await openTab(page, 'Aktionen');
	await expect(page.getByRole('button', { name: 'Als Vorlage sichern' })).toBeVisible();
});
