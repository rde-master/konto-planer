import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

// Runs after vertraege ("Handyvertrag" on "Alltagskonto", which lena may only view;
// nina has no access to it).
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const LENA = { username: 'lena', password: 'lena-richtig-1' };
const NINA = { username: 'nina', password: 'nina-passwort-1' };
const PDF = path.join(import.meta.dirname, '..', 'fixtures', 'testvertrag.pdf');

let itemUrl = '';
let pdfUrl = '';

async function login(page: Page, user: { username: string; password: string }) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(user.username);
	await page.getByLabel('Passwort').fill(user.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('customer number, note and cancellation address', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/dauerposten');
	await page
		.getByRole('link', { name: /Handyvertrag/ })
		.first()
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Handyvertrag' })).toBeVisible();
	itemUrl = new URL(page.url()).pathname;

	await page.getByLabel('Kundennummer (optional)').fill('KD-0815');
	await page.getByLabel('Notiz (optional)').fill('Tarif M\nRufnummer behalten');
	await page.getByLabel('Firma (optional)').fill('Mobilfunk Muster GmbH');
	await page.getByLabel('Straße und Hausnummer (optional)').fill('Musterweg 1');
	await page.getByLabel('PLZ (optional)').fill('12345');
	await page.getByLabel('Ort (optional)').fill('Musterstadt');
	await page.getByLabel('E-Mail für Kündigungen (optional)').fill('kuendigung');
	await page.getByRole('button', { name: 'Sichern', exact: true }).click();
	await expect(page.getByText('Bitte eine gültige E-Mail-Adresse eingeben.')).toBeVisible();
	// The other entries stay in the form.
	await expect(page.getByLabel('Kundennummer (optional)')).toHaveValue('KD-0815');

	await page.getByLabel('E-Mail für Kündigungen (optional)').fill('kuendigung@example.org');
	await page.getByRole('button', { name: 'Sichern', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');
	await expect(page.getByLabel('Notiz (optional)')).toHaveValue('Tarif M\nRufnummer behalten');
});

test('PDF upload: only real PDFs; the file can be opened', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto(itemUrl);
	const documents = page.getByRole('region', { name: 'Dokumente' });

	await documents.locator('input[type=file]').setInputFiles({
		name: 'tarnung.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.from('<html>kein PDF</html>')
	});
	await expect(page.getByRole('alert')).toHaveText('Nur PDF-Dateien sind erlaubt.');

	await documents.locator('input[type=file]').setInputFiles(PDF);
	await expect(page.getByRole('status')).toHaveText('PDF hinzugefügt.');
	const link = documents.getByRole('link', { name: /testvertrag\.pdf/ });
	await expect(link).toContainText('1 KB');
	pdfUrl = (await link.getAttribute('href'))!;

	const res = await page.request.get(pdfUrl);
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toBe('application/pdf');
	expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('viewers see the details read-only; others get 404', async ({ page }) => {
	await login(page, LENA);
	await page.goto(itemUrl);
	const details = page.getByRole('region', { name: 'Details' });
	await expect(details).toContainText('KD-0815');
	await expect(details).toContainText('Mobilfunk Muster GmbH');
	await expect(details).toContainText('12345 Musterstadt');
	await expect(details).toContainText('Rufnummer behalten');
	const documents = page.getByRole('region', { name: 'Dokumente' });
	await expect(documents.getByRole('link', { name: /testvertrag\.pdf/ })).toBeVisible();
	await expect(documents.getByText('PDF hinzufügen')).toHaveCount(0);
	expect((await page.request.get(pdfUrl)).status()).toBe(200);

	await login(page, NINA);
	expect((await page.request.get(pdfUrl)).status()).toBe(404);
});

test('deleting a PDF; uploads and deletions are logged', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto(itemUrl);
	await page.getByRole('button', { name: 'testvertrag.pdf löschen' }).click();
	await page
		.getByRole('dialog', { name: 'PDF löschen' })
		.getByRole('button', { name: 'Löschen' })
		.click();
	await expect(page.getByRole('status')).toHaveText('PDF gelöscht.');
	await expect(page.getByRole('link', { name: /testvertrag\.pdf/ })).toHaveCount(0);
	expect((await page.request.get(pdfUrl)).status()).toBe(404);

	await page.goto('/einstellungen/protokoll?bereich=recurring');
	await expect(page.getByRole('button').filter({ hasText: 'Anhang hinzugefügt' })).toBeVisible();
	await page.getByRole('button').filter({ hasText: 'Anhang gelöscht' }).click();
	await expect(page.getByRole('dialog', { name: 'Eintrag' })).toContainText('testvertrag.pdf');
});
