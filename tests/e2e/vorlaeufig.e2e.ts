import { expect, test, type Page } from '@playwright/test';
import { formatDay, todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';
import { nextBankDay } from '../../src/lib/bank-calendar';

// Own account "Nebenkostenkonto" with an opening date in the past, so due items before today
// are booked provisionally no matter on which weekday the tests run.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Nebenkostenkonto';
const today = todayBerlin();
const dueDay = addDays(today, -10);
const bankDay = nextBankDay(dueDay);

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openAccount(page: Page) {
	await page.goto('/konten');
	await page.getByRole('link', { name: new RegExp(ACCOUNT) }).click();
	await expect(page.getByRole('heading', { level: 1, name: ACCOUNT })).toBeVisible();
}

const balance = (page: Page) => page.getByLabel('Kontostand', { exact: true });

async function createItem(
	page: Page,
	item: { name: string; amount: string; interval: string; date: string }
) {
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await sheet.getByLabel('Bezeichnung').fill(item.name);
	await sheet.getByLabel('Betrag in €').fill(item.amount);
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Intervall').selectOption({ label: item.interval });
	await sheet
		.getByLabel(item.interval === 'Einmalig' ? 'Datum' : 'Erste Fälligkeit')
		.fill(item.date);
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
}

test('due items are booked provisionally on their bank day', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neues Konto' });
	await sheet.getByLabel('Name').fill(ACCOUNT);
	await sheet.getByLabel('Betrag in €').fill('1.000');
	await sheet.getByLabel('Stand am').fill(addDays(today, -30));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	// Monthly from ten days ago: exactly one due item reached its bank day.
	await createItem(page, { name: 'Strom', amount: '85', interval: 'Monatlich', date: dueDay });

	await openAccount(page);
	await expect(balance(page)).toHaveText(/915,00\s€/);

	await page.goto('/buchungen');
	const row = page.getByRole('link', { name: /Strom/ });
	await expect(row).toContainText('vorläufig');
	await row.click();
	await expect(page.locator('main')).toContainText(formatDay(bankDay));
});

test('a provisional booking can get another amount, date or be skipped', async ({ page }) => {
	await login(page);
	await page.goto('/buchungen');
	await page.getByRole('link', { name: /Strom/ }).click();
	const group = page.getByRole('region', { name: 'Vorläufige Buchung' });
	await expect(group).toContainText(formatDay(dueDay));

	await page.getByRole('button', { name: 'Betrag anpassen' }).click();
	const amount = page.getByRole('dialog', { name: 'Betrag anpassen' });
	await amount.getByLabel('Betrag in €').fill('87,40');
	await amount.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Vorläufige Buchung geändert.');
	await expect(page.locator('main')).toContainText(/−87,40\s€/);

	await page.getByRole('button', { name: 'Verschieben' }).click();
	const move = page.getByRole('dialog', { name: 'Verschieben' });
	await move.getByLabel('Gebucht am').fill(addDays(today, -2));
	await move.getByRole('button', { name: 'Sichern' }).click();
	await expect(group).toContainText('Verschoben auf');
	await expect(group).toContainText(formatDay(addDays(today, -2)));

	await openAccount(page);
	await expect(balance(page)).toHaveText(/912,60\s€/);

	await page.goto('/buchungen');
	await page.getByRole('link', { name: /Strom/ }).click();
	await page.getByRole('button', { name: 'Zurücknehmen' }).click();
	await page
		.getByRole('dialog', { name: 'Zurücknehmen' })
		.getByRole('button', { name: 'Zurücknehmen' })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Strom' })).toBeVisible();
	const recent = page.getByRole('region', { name: 'Letzte Fälligkeiten' });
	await expect(recent).toContainText('zurückgenommen');

	await openAccount(page);
	await expect(balance(page)).toHaveText(/1\.000,00\s€/);
});

test('skipped due items can be restored with their changes', async ({ page }) => {
	await login(page);
	await page.goto('/dauerposten');
	await page.getByRole('link', { name: /Strom/ }).click();
	await page.getByRole('button', { name: 'Wiederherstellen' }).click();
	await expect(page.getByRole('status')).toHaveText('Fälligkeit wieder vorläufig gebucht.');
	await expect(page.getByRole('region', { name: 'Letzte Fälligkeiten' })).toContainText(
		'vorläufig gebucht'
	);
	await openAccount(page);
	await expect(balance(page)).toHaveText(/912,60\s€/);
});

test('open payments list upcoming due items', async ({ page }) => {
	await login(page);
	await createItem(page, {
		name: 'Internet',
		amount: '30',
		interval: 'Monatlich',
		date: addDays(today, 3)
	});
	await openAccount(page);
	await page.getByRole('link', { name: 'Offene Zahlungen' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Offene Zahlungen' })).toBeVisible();
	const internet = page.locator('main').getByRole('link', { name: /Internet/ });
	await expect(internet).toHaveCount(1);
	await expect(internet).toContainText(/−30,00\s€/);
	await page.getByRole('link', { name: '3 Monate' }).click();
	await expect(page.locator('main').getByRole('link', { name: /Internet/ })).toHaveCount(3);
});

test('deleting an item removes its provisional bookings; logged', async ({ page }) => {
	await login(page);
	await page.goto('/dauerposten');
	await page.getByRole('link', { name: /Strom/ }).click();
	await page.getByRole('button', { name: 'Dauerposten löschen' }).click();
	await page
		.getByRole('dialog', { name: 'Dauerposten löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page).toHaveURL('/dauerposten');
	await openAccount(page);
	await expect(balance(page)).toHaveText(/1\.000,00\s€/);

	await page.goto('/einstellungen/protokoll?bereich=recurring');
	await expect(
		page
			.getByRole('button')
			.filter({ hasText: 'Fälligkeiten vorläufig gebucht' })
			.filter({ hasText: 'Strom' })
			.first()
	).toBeVisible();
});
