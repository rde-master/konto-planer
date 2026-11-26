import { expect, test, type Page } from '@playwright/test';

// Widget templates: preview, create with own token, script, API, revoke.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('a widget template becomes a Scriptable script with its own token', async ({
	page,
	playwright
}) => {
	await login(page);
	await page.goto('/mehr');
	await page.getByRole('link', { name: 'Widgets' }).click();
	const section = page.getByRole('region', { name: 'Alle Konten' });
	await expect(section.getByRole('img', { name: 'Vorschau' })).toContainText('Konten');
	await section.getByText('Klein', { exact: true }).click();
	await section.getByRole('button', { name: 'Widget anlegen' }).click();
	const script = await section.getByTestId('widget-script').inputValue();
	expect(script).toContain('/api/widget');
	expect(script).toContain('Script.setWidget');
	const token = /const TOKEN = "([^"]+)"/.exec(script)![1];

	const api = await playwright.request.newContext();
	expect((await api.get('/api/widget')).status()).toBe(401);
	const res = await api.get('/api/widget', { headers: { authorization: `Bearer ${token}` } });
	expect(res.status()).toBe(200);
	const body = (await res.json()) as { size: string; blocks: { type: string; text?: string }[] };
	expect(body.size).toBe('small');
	expect(body.blocks[0]).toEqual({ type: 'title', text: 'Konten' });

	const mine = page.getByRole('region', { name: 'Meine Widgets' });
	await expect(mine.getByRole('listitem', { name: 'Alle Konten' })).toContainText('Klein');
	await mine
		.getByRole('listitem', { name: 'Alle Konten' })
		.getByRole('button', { name: 'Widerrufen' })
		.click();
	await expect(page.getByRole('status')).toHaveText(/Widget widerrufen/);
	expect(
		(await api.get('/api/widget', { headers: { authorization: `Bearer ${token}` } })).status()
	).toBe(401);
	await api.dispose();
});
