import { expect, test, type Page } from '@playwright/test';
import { openTab } from './reiter';

// Runs after schnellerfassung (giro "Alltagskonto"; lena may only view it).
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const LENA = { username: 'lena', password: 'lena-richtig-1' };
const ACCOUNT = 'Alltagskonto';

async function login(page: Page, user: { username: string; password: string }) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(user.username);
	await page.getByLabel('Passwort').fill(user.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

function quickSheet(page: Page) {
	return page.getByRole('dialog', { name: 'Schnellerfassung' });
}

test('templates are created under settings', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/einstellungen');
	await page.getByRole('link', { name: 'Vorlagen' }).click();
	await expect(page.getByText('Noch keine Vorlagen')).toBeVisible();

	await page.getByRole('button', { name: 'Vorlage anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Vorlage' });
	await sheet.getByLabel('Name').fill('Bäcker');
	await sheet.getByLabel('Betrag in € (optional)').fill('0');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet.getByText('Bitte einen Betrag größer 0 eingeben')).toBeVisible();
	await expect(sheet.getByLabel('Name')).toHaveValue('Bäcker');

	await sheet.getByLabel('Betrag in € (optional)').fill('3,20');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill('Bäckerei Muster');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Vorlage „Bäcker“ wurde angelegt.');

	await page.getByRole('button', { name: 'Vorlage anlegen' }).click();
	await sheet.getByLabel('Name').fill('Tanken');
	await sheet.getByRole('switch', { name: /Für alle Benutzer/ }).check();
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await expect(
		page.getByRole('region', { name: 'Meine Vorlagen' }).getByRole('button', { name: /Bäcker/ })
	).toContainText(/−3,20\s€ · Alltagskonto/);
	await expect(
		page.getByRole('region', { name: 'Für alle' }).getByRole('button', { name: /Tanken/ })
	).toContainText('Betrag offen');
});

test('one tap on a template fills the quick entry', async ({ page }) => {
	await login(page, ADMIN);
	await page.getByRole('button', { name: 'Schnellerfassung' }).click();
	const sheet = quickSheet(page);
	await sheet.getByRole('button', { name: 'Bäcker', exact: true }).click();
	await expect(sheet.getByLabel('Betrag in €')).toHaveValue('3,20');
	await expect(sheet.getByText('Empfänger/Zahler: Bäckerei Muster')).toBeVisible();
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText(/−3,20\s€ auf Alltagskonto gebucht\./);

	// Without an amount only the amount is asked for.
	await page.getByRole('button', { name: 'Schnellerfassung' }).click();
	await sheet.getByRole('button', { name: 'Tanken', exact: true }).click();
	await expect(sheet.getByLabel('Betrag in €')).toHaveValue('');
	await expect(sheet.getByLabel('Betrag in €')).toBeFocused();
	await page.keyboard.type('40');
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	await page.goto('/buchungen');
	const today = page.getByRole('region', { name: 'Heute' });
	await expect(today.getByRole('link', { name: /Bäckerei Muster/ })).toContainText(/−3,20\s€/);
	await expect(today).toContainText(/−40,00\s€/);
});

test('others see shared templates only and cannot delete them', async ({ page }) => {
	await login(page, LENA);
	await page.goto('/einstellungen/vorlagen');
	await expect(page.getByRole('button', { name: /Bäcker/ })).toHaveCount(0);
	await page.getByRole('button', { name: /Tanken/ }).click();
	const sheet = page.getByRole('dialog', { name: 'Vorlage' });
	await expect(
		sheet.getByText('Gemeinsame Vorlage – alle Benutzer sehen und nutzen sie.')
	).toBeVisible();
	await expect(sheet.getByRole('button', { name: 'Vorlage löschen' })).toHaveCount(0);
	await sheet.getByLabel('Name').fill('Tankstelle');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Vorlage „Tankstelle“ wurde gesichert.');
});

test('a booking is saved as template; order and deletion; protocol', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/buchungen');
	await page
		.getByRole('region', { name: 'Heute' })
		.getByRole('link', { name: /Bäckerei Muster/ })
		.click();
	await openTab(page, 'Aktionen');
	await page.getByRole('button', { name: 'Als Vorlage sichern' }).click();
	const sheet = page.getByRole('dialog', { name: 'Als Vorlage sichern' });
	await expect(sheet.getByLabel('Name')).toHaveValue('Bäckerei Muster');
	await expect(sheet.getByLabel('Betrag in € (optional)')).toHaveValue('3,20');
	await sheet.getByLabel('Name').fill('Bäcker');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet.getByText('Eine Vorlage mit diesem Namen gibt es hier schon.')).toBeVisible();
	await sheet.getByLabel('Name').fill('Bäcker groß');
	await sheet.getByLabel('Betrag in € (optional)').fill('7,90');
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toContainText('Vorlage „Bäcker groß“ gesichert.');

	await page.goto('/einstellungen/vorlagen');
	const own = page.getByRole('region', { name: 'Meine Vorlagen' });
	await page.getByRole('button', { name: 'Ordnen' }).click();
	await own.getByRole('button', { name: 'Bäcker groß nach oben' }).click();
	await expect(own.getByRole('listitem').first()).toContainText('Bäcker groß');
	await page.getByRole('button', { name: 'Fertig' }).click();

	await page.getByRole('button', { name: 'Schnellerfassung' }).click();
	const chips = quickSheet(page).getByRole('group', { name: 'Vorlagen' }).getByRole('button');
	await expect(chips).toHaveText(['Bäcker groß', 'Bäcker', 'Tankstelle']);
	await page.keyboard.press('Escape');

	await own.getByRole('button', { name: /Bäcker groß/ }).click();
	await page
		.getByRole('dialog', { name: 'Vorlage' })
		.getByRole('button', { name: 'Vorlage löschen' })
		.click();
	await page
		.getByRole('dialog', { name: 'Vorlage löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page.getByRole('status')).toHaveText('Vorlage „Bäcker groß“ wurde gelöscht.');

	await page.goto('/einstellungen/protokoll?bereich=template');
	await expect(
		page.getByRole('button').filter({ hasText: 'Vorlage angelegt' }).first()
	).toBeVisible();
	await expect(
		page.getByRole('button').filter({ hasText: 'Vorlage geändert' }).first()
	).toBeVisible();
	await expect(page.getByRole('button').filter({ hasText: 'Vorlage gelöscht' })).toBeVisible();
});
