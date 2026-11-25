import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays } from '../../src/lib/recurring';

// Tags on a booking and on a recurring item (inherited by its bookings), own account.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Tagkonto';
const today = todayBerlin();

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('tags are created once (case ignored)', async ({ page }) => {
	await login(page);
	await page.goto('/mehr');
	await page.getByRole('link', { name: 'Tags' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Tags' })).toBeVisible();
	for (const name of ['#Urlaub Italien', 'urlaub italien']) {
		await page.getByRole('button', { name: 'Tag anlegen' }).click();
		const sheet = page.getByRole('dialog', { name: 'Neuer Tag' });
		await sheet.getByLabel('Name').fill(name);
		await sheet.getByRole('button', { name: 'Anlegen' }).click();
		if (name.startsWith('#')) {
			await expect(sheet).toBeHidden();
			await expect(page.getByRole('status')).toHaveText('Tag „Urlaub Italien“ angelegt.');
		} else await expect(sheet.getByText('Diesen Tag gibt es schon.')).toBeVisible();
	}
});

test('a booking gets tags; the tag page lists it', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('1.000');
	await account.getByLabel('Stand am').fill(addDays(today, -30));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('80');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill('Hotel Bella Vista');
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	await page.getByRole('link', { name: /Hotel Bella Vista/ }).click();
	await page.getByRole('button', { name: 'Tags ändern' }).click();
	const tags = page.getByRole('dialog', { name: 'Tags' });
	await tags.getByLabel('Urlaub Italien').check();
	await tags.getByLabel('Neuer Tag').fill('Reise');
	await tags.getByRole('button', { name: 'Sichern' }).click();
	await expect(tags).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Tags gesichert.');
	const region = page.getByRole('region', { name: 'Tags' });
	await expect(region.getByRole('link', { name: 'Urlaub Italien' })).toBeVisible();
	await expect(region.getByRole('link', { name: 'Reise' })).toBeVisible();

	await region.getByRole('link', { name: 'Urlaub Italien' }).click();
	await expect(page.getByRole('heading', { level: 1, name: '#Urlaub Italien' })).toBeVisible();
	await expect(page.getByLabel('Ausgaben', { exact: true })).toHaveText(/−80,00\s€/);
	await expect(page.locator('main')).toContainText('Hotel Bella Vista');
});

test('tags of a recurring item apply to its bookings', async ({ page }) => {
	await login(page);
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await sheet.getByLabel('Bezeichnung').fill('Ferienwohnung');
	await sheet.getByLabel('Betrag in €').fill('300');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Erste Fälligkeit').fill(addDays(today, -10));
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await page.getByRole('link', { name: /^Ferienwohnung/ }).click();
	await page.getByRole('button', { name: 'Tags ändern' }).click();
	const tags = page.getByRole('dialog', { name: 'Tags' });
	await tags.getByLabel('Urlaub Italien').check();
	await tags.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Tags gesichert.');

	// The provisional booking carries the tag of its item.
	await page.goto('/buchungen');
	await page
		.getByRole('link', { name: /Ferienwohnung/ })
		.first()
		.click();
	const region = page.getByRole('region', { name: 'Tags' });
	await expect(region.getByRole('link', { name: 'Urlaub Italien' })).toBeVisible();
	await expect(region).toContainText('Graue Tags kommen vom Dauerposten.');

	await region.getByRole('link', { name: 'Urlaub Italien' }).click();
	await expect(page.getByRole('region', { name: 'Dauerposten mit diesem Tag' })).toContainText(
		'Ferienwohnung'
	);
});

test('rename and delete; logged', async ({ page }) => {
	await login(page);
	await page.goto('/tags');
	await page.getByRole('link', { name: /Urlaub Italien/ }).click();
	await page.getByRole('button', { name: 'Umbenennen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Umbenennen' });
	await sheet.getByLabel('Name').fill('Urlaub Toskana');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('heading', { level: 1, name: '#Urlaub Toskana' })).toBeVisible();

	await page.goto('/tags');
	await page.getByRole('link', { name: /Reise/ }).click();
	await page.getByRole('button', { name: 'Tag löschen' }).click();
	await page
		.getByRole('dialog', { name: 'Tag löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page).toHaveURL('/tags');
	await expect(page.getByRole('link', { name: /Reise/ })).toHaveCount(0);

	await page.goto('/einstellungen/protokoll?bereich=tag');
	await expect(page.getByRole('button').filter({ hasText: 'Tag angelegt' }).first()).toBeVisible();
	await expect(page.getByRole('button').filter({ hasText: 'Tag gelöscht' }).first()).toBeVisible();
});
