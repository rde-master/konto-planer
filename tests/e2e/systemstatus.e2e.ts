import postgres from 'postgres';
import { expect, test, type Page } from '@playwright/test';

// System status for the admin and "Was ist neu" after an update.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const DATABASE_URL =
	process.env.E2E_DATABASE_URL ??
	'postgres://kontoplaner:kontoplaner@localhost:5432/kontoplaner_e2e';

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('the admin sees version, jobs, connections, storage and backups', async ({ page }) => {
	await login(page);
	await page.goto('/einstellungen');
	await page.getByRole('link', { name: 'Systemstatus' }).click();
	await expect(page.getByRole('region', { name: 'Version' })).toContainText('Konto Planer');
	const jobs = page.getByRole('region', { name: 'Hintergrundjobs' });
	await expect(jobs).toContainText('Fälligkeiten, Abrechnungen, Zinsen');
	await expect(page.getByRole('region', { name: 'Verbindungen' })).toContainText('E-Mail (SMTP)');
	await expect(page.getByRole('region', { name: 'Datenbank und Speicher' })).toContainText(
		'PostgreSQL'
	);
	// pg_dump exists in the Docker image; on a developer machine it may be missing.
	await page.getByRole('button', { name: 'Jetzt sichern' }).click();
	await expect(page.getByRole('status').or(page.getByRole('alert'))).toContainText(/Sicherung/);
});

test('after an update everyone sees "Was ist neu" once', async ({ page }) => {
	const sql = postgres(DATABASE_URL, { onnotice: () => {} });
	await sql`update users set last_seen_version = '0.56.0' where username = ${ADMIN.username}`;
	await sql.end();

	await login(page);
	const sheet = page.getByRole('dialog', { name: 'Was ist neu' });
	await expect(sheet).toBeVisible();
	await expect(sheet).toContainText('Schnellerfassung per iOS-Kurzbefehl');
	await expect(sheet).not.toContainText('Sperrbildschirm-Widgets');
	await sheet.getByRole('button', { name: 'Fertig' }).click();
	await expect(sheet).toBeHidden();

	await page.reload();
	await expect(page.getByRole('dialog', { name: 'Was ist neu' })).toBeHidden();
	await page.goto('/einstellungen/neuigkeiten');
	await expect(page.getByRole('region', { name: /^Version 0\./ }).first()).toBeVisible();
});
