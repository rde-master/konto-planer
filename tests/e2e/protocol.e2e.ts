import { expect, test, type Page } from '@playwright/test';

// Runs after foundation.e2e.ts (admin "erika") and lockout.e2e.ts (user "lena", lock + unlock).
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const LENA = { name: 'Lena Sperre', username: 'lena', password: 'lena-richtig-1' };

async function login(page: Page, username: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(username);
	await page.getByLabel('Passwort').fill(password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

function row(page: Page, title: string, subtitle: RegExp) {
	return page.getByRole('button').filter({ hasText: title }).filter({ hasText: subtitle });
}

test('earlier actions appear in the protocol', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/einstellungen');
	await page.getByRole('link', { name: 'Protokoll' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Protokoll' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Heute' })).toBeVisible();

	await expect(row(page, 'Benutzer angelegt', /Erika Muster · von Erika Muster/)).toBeVisible();
	await expect(row(page, 'Benutzer angelegt', /Lena Sperre · von Erika Muster/)).toBeVisible();
	await expect(row(page, 'Anmeldung gesperrt', /lena/).first()).toBeVisible();
	await expect(row(page, 'Sperre aufgehoben', /Lena Sperre/)).toBeVisible();
	await expect(row(page, 'Angemeldet', /Erika Muster/).first()).toBeVisible();
	await expect(row(page, 'Anmeldung fehlgeschlagen', /gibtsnicht/).first()).toBeVisible();
	await expect(row(page, 'Abgemeldet', /Erika Muster/).first()).toBeVisible();
});

test('details show the stored values but never the password', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/einstellungen/protokoll');
	await row(page, 'Benutzer angelegt', /Lena Sperre/).click();
	const sheet = page.getByRole('dialog', { name: 'Eintrag' });
	await expect(sheet.getByText('Benutzer angelegt')).toBeVisible();
	await expect(sheet.getByText('Ausgeführt von')).toBeVisible();
	await expect(sheet.getByText('lena', { exact: true })).toBeVisible();
	await expect(sheet.getByText('Rolle')).toBeVisible();
	const html = await page.content();
	expect(html).not.toContain('argon2');
	expect(html).not.toContain(LENA.password);
	expect(html.toLowerCase()).not.toContain('passwordhash');
});

test('an edit is logged with before and after', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/einstellungen/benutzer');
	await page.getByRole('link', { name: /Lena Sperre/ }).click();
	await page.getByLabel('E-Mail (optional)').fill('lena@example.org');
	await page.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');

	await page.goto('/einstellungen/protokoll');
	await row(page, 'Benutzer geändert', /Lena Sperre/).click();
	const sheet = page.getByRole('dialog', { name: 'Eintrag' });
	await expect(sheet.getByRole('heading', { name: 'Änderungen' })).toBeVisible();
	await expect(sheet.getByText('E-Mail')).toBeVisible();
	await expect(sheet.getByText('lena@example.org')).toBeVisible();
	// Unchanged fields are not part of the entry.
	await expect(sheet.getByText('Rolle')).toHaveCount(0);
});

test('filters narrow the list and can be reset', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/einstellungen/protokoll');
	await page.getByRole('button', { name: 'Filter' }).click();
	const sheet = page.getByRole('dialog', { name: 'Filter' });
	await sheet.getByLabel('Aktion').selectOption({ label: 'Anmeldung fehlgeschlagen' });
	await sheet.getByRole('button', { name: 'Anwenden' }).click();

	await expect(page).toHaveURL(/aktion=login_failed/);
	await expect(page.getByLabel('Aktive Filter')).toContainText('Anmeldung fehlgeschlagen');
	await expect(row(page, 'Anmeldung fehlgeschlagen', /./).first()).toBeVisible();
	await expect(row(page, 'Benutzer angelegt', /./)).toHaveCount(0);

	await page.getByRole('link', { name: 'Zurücksetzen' }).click();
	await expect(page).toHaveURL('/einstellungen/protokoll');
	await expect(row(page, 'Benutzer angelegt', /./).first()).toBeVisible();

	await page.goto('/einstellungen/protokoll?von=2000-01-01&bis=2000-01-31');
	await expect(page.getByText('Keine Einträge für diesen Filter.')).toBeVisible();
});

test('long protocols are paged without gaps or duplicates', async ({ page }) => {
	// 55 failed logins with distinct names -> more than one page of 50.
	for (let i = 0; i < 55; i++) {
		await page.request.post('/login', {
			form: { username: `blaetter${i}`, password: 'falsch-falsch' },
			headers: { origin: test.info().project.use.baseURL!, 'x-sveltekit-action': 'true' }
		});
	}
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/einstellungen/protokoll?aktion=login_failed');
	const names = async () =>
		(
			await page
				.getByRole('button')
				.filter({ hasText: /blaetter\d+/ })
				.allTextContents()
		).map((t) => /blaetter\d+/.exec(t)![0]);
	const first = await names();
	expect(first).toHaveLength(50);
	expect(first[0]).toBe('blaetter54');

	await page.getByRole('link', { name: 'Ältere Einträge' }).click();
	await expect(page).toHaveURL(/aktion=login_failed&vor=\d+/);
	const second = await names();
	expect(second).toEqual(['blaetter4', 'blaetter3', 'blaetter2', 'blaetter1', 'blaetter0']);
});

test('normal users cannot open the protocol', async ({ page }) => {
	await login(page, LENA.username, LENA.password);
	await page.goto('/einstellungen');
	await expect(page.getByRole('link', { name: 'Protokoll' })).toHaveCount(0);
	const response = await page.goto('/einstellungen/protokoll');
	expect(response?.status()).toBe(403);
});
