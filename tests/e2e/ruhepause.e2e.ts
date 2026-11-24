import { expect, test, type Page } from '@playwright/test';
import { formatDay, todayBerlin } from '../../src/lib/dates';
import { addMonths } from '../../src/lib/recurring';

// Runs after recurring (admin "erika", giro account "Alltagskonto").
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const today = todayBerlin();
const month = (k: number) => addMonths(today, k);

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function openItem(page: Page) {
	await page.goto('/dauerposten');
	await page
		.getByRole('region', { name: 'Alltagskonto' })
		.getByRole('link', { name: /Zeitung/ })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Zeitung' })).toBeVisible();
}

function upcoming(page: Page) {
	return page.getByRole('region', { name: 'Nächste Fälligkeiten' }).getByRole('listitem');
}

test('a pause skips the due dates in between', async ({ page }) => {
	await login(page);
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const create = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await create.getByLabel('Bezeichnung').fill('Zeitung');
	await create.getByLabel('Betrag in €').fill('20');
	await create.getByLabel('Konto').selectOption({ label: 'Alltagskonto' });
	await create.getByLabel('Erste Fälligkeit').fill(today);
	await create.getByRole('button', { name: 'Anlegen' }).click();
	await expect(create).toBeHidden();

	await openItem(page);
	await page.getByRole('button', { name: 'Pausieren' }).click();
	const sheet = page.getByRole('dialog', { name: 'Pausieren' });
	await sheet.getByLabel('Pause ab').fill(month(3));
	await sheet.getByLabel('Pause bis (optional)').fill(month(1));
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet.getByText('Die Pause kann nicht vor ihrem Beginn enden.')).toBeVisible();

	await sheet.getByLabel('Pause ab').fill(month(1));
	await sheet.getByLabel('Pause bis (optional)').fill(month(3));
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Pause gesichert.');

	await expect(upcoming(page).nth(0)).toContainText(formatDay(today));
	await expect(upcoming(page).nth(1)).toContainText(formatDay(month(4)));
	const pause = page.getByRole('region', { name: 'Pause' });
	await expect(pause).toContainText(formatDay(month(1)));
	await expect(pause).toContainText(formatDay(month(3)));

	await page.goto('/dauerposten');
	await expect(
		page.getByRole('region', { name: 'Alltagskonto' }).getByRole('link', { name: /Zeitung/ })
	).toContainText(`Pause ${formatDay(month(1))} – ${formatDay(month(3))}`);
});

test('ending a future pause removes it; an open pause stops all due dates', async ({ page }) => {
	await login(page);
	await openItem(page);
	await page.getByRole('button', { name: 'Pause beenden' }).click();
	await expect(page.getByRole('status')).toHaveText('Pause beendet.');
	await expect(upcoming(page).nth(1)).toContainText(formatDay(month(1)));

	await page.getByRole('button', { name: 'Pausieren' }).click();
	const sheet = page.getByRole('dialog', { name: 'Pausieren' });
	await sheet.getByLabel('Pause ab').fill(month(1));
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(upcoming(page)).toHaveCount(1);
	await expect(page.getByRole('region', { name: 'Pause' })).toContainText('bis auf Weiteres');

	await page.getByRole('button', { name: 'Pause ändern' }).click();
	await page.getByRole('dialog', { name: 'Pause ändern' }).getByLabel('Pause ab').fill(today);
	await page
		.getByRole('dialog', { name: 'Pause ändern' })
		.getByRole('button', { name: 'Sichern' })
		.click();
	await expect(page.getByText('Keine Fälligkeiten – der Dauerposten ruht')).toBeVisible();

	await page.goto('/dauerposten');
	const row = page.getByRole('region', { name: 'Alltagskonto' }).getByRole('link', {
		name: /Zeitung/
	});
	await expect(row).toContainText('monatlich · pausiert');
});

test('pauses are logged', async ({ page }) => {
	await login(page);
	await page.goto('/einstellungen/protokoll?bereich=recurring');
	await page
		.getByRole('button')
		.filter({ hasText: 'Pausiert' })
		.filter({ hasText: 'Zeitung' })
		.first()
		.click();
	await expect(page.getByRole('dialog', { name: 'Eintrag' })).toContainText('Pause ab');
	await page.keyboard.press('Escape');
	await expect(
		page.getByRole('button').filter({ hasText: 'Pause beendet' }).filter({ hasText: 'Zeitung' })
	).toBeVisible();
});
