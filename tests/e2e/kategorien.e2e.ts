import { expect, test, type Page } from '@playwright/test';

// Runs after foundation.e2e.ts, which created the admin "erika".
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const NINA = { name: 'Nina Norm', username: 'nina', password: 'nina-passwort-1' };

async function login(page: Page, username: string, password: string) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(username);
	await page.getByLabel('Passwort').fill(password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

function group(page: Page, name: string) {
	return page.getByRole('region', { name, exact: true });
}

test('suggested categories can be taken over once', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.getByRole('navigation').last().getByRole('link', { name: 'Mehr' }).click();
	await page.getByRole('link', { name: 'Kategorien' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Kategorien' })).toBeVisible();
	await expect(page.getByText('Noch keine Kategorien')).toBeVisible();

	await page.getByRole('button', { name: 'Vorschläge übernehmen' }).click();
	await expect(page.getByRole('status')).toContainText(/\d+ Kategorien wurden angelegt\./);
	await expect(page.getByRole('button', { name: 'Vorschläge übernehmen' })).toHaveCount(0);
	const wohnen = group(page, 'Wohnen');
	await expect(wohnen.getByRole('button', { name: 'Miete' })).toBeVisible();
	await expect(wohnen.getByRole('button', { name: 'Strom' })).toBeVisible();
});

test('admin creates a main category and a subcategory', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/kategorien');
	await page.getByRole('button', { name: 'Kategorie anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Kategorie' });
	await sheet.getByLabel('Name').fill('Haustiere');
	await sheet.getByTitle('Lila').click();
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Kategorie „Haustiere“ wurde angelegt.');

	// Subcategory via the row inside the group: parent is preselected, no colour picker.
	await group(page, 'Haustiere').getByRole('button', { name: 'Unterkategorie' }).click();
	await expect(sheet.getByLabel('Hauptkategorie')).toHaveValue(/.+/);
	await expect(sheet.getByTitle('Lila')).toHaveCount(0);
	await sheet.getByLabel('Name').fill('Tierarzt');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();
	await expect(group(page, 'Haustiere').getByRole('button', { name: 'Tierarzt' })).toBeVisible();
});

test('duplicates among siblings are rejected', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/kategorien');
	await group(page, 'Wohnen').getByRole('button', { name: 'Unterkategorie' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Kategorie' });
	await sheet.getByLabel('Name').fill('miete');
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet.getByText('Diese Unterkategorie gibt es hier schon.')).toBeVisible();
});

test('a normal user can create and edit but not delete', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/einstellungen/benutzer');
	await page.getByRole('button', { name: 'Benutzer anlegen' }).click();
	const userSheet = page.getByRole('dialog', { name: 'Neuer Benutzer' });
	await userSheet.getByLabel('Name', { exact: true }).fill(NINA.name);
	await userSheet.getByLabel('Benutzername').fill(NINA.username);
	await userSheet.getByLabel('Passwort', { exact: true }).fill(NINA.password);
	await userSheet.getByLabel('Passwort wiederholen').fill(NINA.password);
	await userSheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(userSheet).toBeHidden();

	await login(page, NINA.username, NINA.password);
	await page.goto('/kategorien');
	// Move "Tierarzt" to "Gesundheit" and rename it.
	await group(page, 'Haustiere').getByRole('button', { name: 'Tierarzt' }).click();
	const sheet = page.getByRole('dialog', { name: 'Kategorie', exact: true });
	await expect(sheet.getByRole('button', { name: 'Kategorie löschen' })).toHaveCount(0);
	await sheet.getByLabel('Name').fill('Tierarztpraxis');
	await sheet.getByLabel('Hauptkategorie').selectOption({ label: 'Gesundheit' });
	await sheet.getByRole('button', { name: 'Sichern' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('status')).toHaveText('Kategorie „Tierarztpraxis“ wurde gesichert.');
	await expect(
		group(page, 'Gesundheit').getByRole('button', { name: 'Tierarztpraxis' })
	).toBeVisible();
	await expect(group(page, 'Haustiere').getByRole('button', { name: 'Tierarzt' })).toHaveCount(0);

	// Main categories with children cannot become subcategories.
	await group(page, 'Wohnen').getByRole('button', { name: 'Wohnen' }).click();
	await expect(sheet.getByLabel('Hauptkategorie')).toHaveCount(0);
	await expect(sheet.getByText('Hat Unterkategorien')).toBeVisible();
	await sheet.getByRole('button', { name: 'Abbrechen' }).click();

	// Delete is refused on the server, too.
	const res = await page.request.post('/kategorien?/delete', {
		form: { id: '00000000-0000-0000-0000-000000000000' },
		headers: { origin: test.info().project.use.baseURL!, 'x-sveltekit-action': 'true' }
	});
	expect(await res.text()).toContain('Nur für Admins');
});

test('admin deletes a main category together with its subcategories', async ({ page }) => {
	await login(page, ADMIN.username, ADMIN.password);
	await page.goto('/kategorien');
	await group(page, 'Wohnen').getByRole('button', { name: 'Wohnen' }).click();
	await page
		.getByRole('dialog', { name: 'Kategorie', exact: true })
		.getByRole('button', { name: 'Kategorie löschen' })
		.click();
	const confirm = page.getByRole('dialog', { name: 'Kategorie löschen' });
	await expect(confirm).toContainText('und ihre 5 Unterkategorien werden gelöscht');
	await confirm.getByRole('button', { name: 'Löschen' }).click();
	await expect(page.getByRole('status')).toHaveText('Kategorie „Wohnen“ wurde gelöscht.');
	await expect(group(page, 'Wohnen')).toHaveCount(0);

	await page.goto('/einstellungen/protokoll?bereich=category&aktion=delete');
	await expect(
		page.getByRole('button').filter({ hasText: 'Kategorie gelöscht' }).filter({ hasText: 'Miete' })
	).toBeVisible();
	await page.goto('/einstellungen/protokoll?bereich=category&aktion=update');
	await page.getByRole('button').filter({ hasText: 'Tierarztpraxis' }).click();
	const entry = page.getByRole('dialog', { name: 'Eintrag' });
	await expect(entry.getByText('Hauptkategorie')).toBeVisible();
	await expect(entry.getByText('Haustiere')).toBeVisible();
	await expect(entry.getByText('Gesundheit')).toBeVisible();
	await expect(entry.getByText('Nina Norm', { exact: true })).toBeVisible();
});
