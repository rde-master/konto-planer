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

test('a widget is designed in the editor and changed later without a new script', async ({
	page,
	playwright
}) => {
	await login(page);
	await page.goto('/widgets');
	await page.getByRole('link', { name: 'Eigenes Widget im Editor gestalten' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Neues Widget' })).toBeVisible();
	await page.getByLabel('Name').fill('Mein Testwidget');
	await page.getByLabel('Text der Überschrift').fill('Haushalt');
	await page.getByLabel('Neuer Baustein').selectOption({ label: 'Nächste Zahlung' });
	await page.getByRole('button', { name: 'Hinzufügen' }).click();
	await expect(page.getByRole('listitem', { name: 'Nächste Zahlung' })).toBeVisible();
	await page.getByLabel('Hintergrund').selectOption({ label: 'Verlauf' });
	await expect(page.getByRole('img', { name: 'Vorschau' })).toContainText('Haushalt');
	await page.getByRole('button', { name: 'Widget anlegen' }).click();

	const script = await page.getByTestId('widget-script').inputValue();
	const token = /const TOKEN = "([^"]+)"/.exec(script)![1];
	const api = await playwright.request.newContext();
	const get = async () => {
		const res = await api.get('/api/widget', { headers: { authorization: `Bearer ${token}` } });
		expect(res.status()).toBe(200);
		return (await res.json()) as {
			name: string;
			size: string;
			blocks: { type: string; text?: string; label?: string }[];
			style: { gradient: unknown; scale: number };
		};
	};
	let body = await get();
	expect(body.name).toBe('Mein Testwidget');
	expect(body.blocks[0]).toEqual({ type: 'title', text: 'Haushalt' });
	expect(body.style.gradient).not.toBeNull();

	// Edit: bigger, larger font, without the next payment – same script.
	await page.getByRole('link', { name: 'Weiter bearbeiten' }).click();
	await page.getByRole('radio', { name: 'Groß' }).click();
	await page.getByLabel('Schriftgröße').selectOption({ label: 'Groß' });
	await page
		.getByRole('listitem', { name: 'Nächste Zahlung' })
		.getByRole('button', { name: 'Entfernen' })
		.click();
	await page.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toContainText('Gesichert');
	body = await get();
	expect(body.size).toBe('large');
	expect(body.style.scale).toBe(1.2);
	expect(body.blocks.some((b) => b.label?.startsWith('Nächste'))).toBe(false);
	await api.dispose();
});

test('lock screen widgets: circular ring and one line', async ({ page, playwright }) => {
	await login(page);
	await page.goto('/widgets');
	const section = page.getByRole('region', { name: 'Verfügbar bis Gehalt' });
	await section.getByText('Rund', { exact: true }).click();
	await expect(section.getByRole('img', { name: 'Vorschau' })).toBeVisible();
	await section.getByRole('button', { name: 'Widget anlegen' }).click();
	const script = await section.getByTestId('widget-script').inputValue();
	const token = /const TOKEN = "([^"]+)"/.exec(script)![1];

	const api = await playwright.request.newContext();
	const res = await api.get('/api/widget', { headers: { authorization: `Bearer ${token}` } });
	const body = (await res.json()) as {
		size: string;
		blocks: unknown[];
		lock: { lines: string[]; gauge: { value: number; label: string } | null };
	};
	expect(body.size).toBe('lockCircle');
	expect(body.blocks).toEqual([]);
	expect(body.lock.gauge?.label).toMatch(/^−?\d/);
	await api.dispose();

	// In the editor the size can become a line above the clock.
	await page.goto('/widgets');
	await page
		.getByRole('region', { name: 'Meine Widgets' })
		.getByRole('link', { name: /Verfügbar bis Gehalt · Rund/ })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Verfügbar bis Gehalt' })).toBeVisible();
	await page.getByRole('radio', { name: 'Zeile', exact: true }).click();
	await expect(page.getByRole('img', { name: 'Vorschau' })).toContainText('€');
	await page.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toContainText('Gesichert');
});
