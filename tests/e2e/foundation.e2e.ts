import { expect, test } from '@playwright/test';

// The tests build on each other: fresh install -> setup -> navigation -> logout -> login.
test.describe.configure({ mode: 'serial' });

const ADMIN = { name: 'Erika Muster', username: 'erika', password: 'sehr-geheim-123' };

test('fresh install redirects to setup and validates input', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup$/);
	await expect(page.getByRole('heading', { name: 'Willkommen' })).toBeVisible();

	await page.getByLabel('Name', { exact: true }).fill(ADMIN.name);
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill('kurz');
	await page.getByLabel('Passwort wiederholen').fill('anders');
	await page.getByRole('button', { name: 'Admin anlegen' }).click();
	await expect(page.getByText('Mindestens 10 Zeichen.').first()).toBeVisible();
	await expect(page.getByText('Die Passwörter stimmen nicht überein.')).toBeVisible();
});

test('first admin is created and lands on the overview', async ({ page }) => {
	await page.goto('/setup');
	await page.getByLabel('Name', { exact: true }).fill(ADMIN.name);
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByLabel('Passwort wiederholen').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Admin anlegen' }).click();

	await expect(page).toHaveURL('/');
	await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
	await expect(page.getByText('Hallo Erika!')).toBeVisible();
});

test('setup is closed once an admin exists', async ({ page }) => {
	await page.goto('/setup');
	await expect(page).toHaveURL(/\/login$/);
});

test('wrong password is rejected', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort').fill('falsches-passwort');
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page.getByRole('alert')).toHaveText('Benutzername oder Passwort ist falsch.');
});

test('login, tab bar navigation, theme switch and logout on a phone', async ({ page }) => {
	await page.goto('/konten');
	await expect(page).toHaveURL(/\/login\?redirectTo=%2Fkonten$/);
	await page.getByLabel('Benutzername').fill(ADMIN.username.toUpperCase());
	await page.getByLabel('Passwort').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/konten');

	const tabBar = page.getByRole('navigation', { name: 'Hauptnavigation' }).last();
	await expect(tabBar).toBeVisible();
	for (const [label, heading] of [
		['Dauerposten', 'Dauerposten'],
		['Buchungen', 'Buchungen'],
		['Mehr', 'Mehr'],
		['Übersicht', 'Übersicht']
	]) {
		await tabBar.getByRole('link', { name: label }).click();
		await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
	}

	// Without accounts the admin is pointed to "Konten", not told about missing rights.
	await tabBar.getByRole('link', { name: 'Dauerposten' }).click();
	await expect(page.getByText('Lege zuerst unter Konten ein Girokonto an')).toBeVisible();
	await expect(page.getByText('Recht „Bearbeiten“')).toHaveCount(0);

	await page.goto('/einstellungen');
	const saved = page.waitForResponse((r) => r.url().includes('/einstellungen?/theme') && r.ok());
	await page.getByRole('radio', { name: 'Dunkel' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await saved;
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.getByRole('radio', { name: 'Dunkel' })).toHaveAttribute('aria-checked', 'true');

	await page.getByRole('button', { name: 'Abmelden' }).click();
	await expect(page).toHaveURL(/\/login$/);
	await page.goto('/');
	await expect(page).toHaveURL(/\/login$/);
});

test('PWA manifest, icons and health endpoint are served', async ({ request }) => {
	const manifest = await request.get('/manifest.webmanifest');
	expect(manifest.ok()).toBe(true);
	const json = (await manifest.json()) as { display: string; icons: { src: string }[] };
	expect(json.display).toBe('standalone');
	for (const icon of json.icons) expect((await request.get(icon.src)).ok()).toBe(true);
	expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBe(true);

	const health = await request.get('/api/health');
	expect(await health.json()).toMatchObject({ status: 'ok' });
});

test('desktop sidebar has every section and shows the version', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');

	const sidebar = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
	await expect(sidebar).toBeVisible();
	for (const label of ['Geplante Zahlungen', 'Sparziele', 'Rücklagen', 'Kategorien'])
		await expect(sidebar.getByRole('link', { name: label })).toBeVisible();
	await expect(sidebar.getByLabel('Version')).toHaveText(/^Version \d+\.\d+\.\d+$/);
	await sidebar.getByRole('link', { name: 'Kategorien' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Kategorien' })).toBeVisible();

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/mehr');
	await expect(page.getByText(/^Konto Planer \d+\.\d+\.\d+$/)).toBeVisible();
});
