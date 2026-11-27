import { expect, test, type Page } from '@playwright/test';

// "iOS Kurzbefehle": the menu entry where a shortcut gets its own access, with the steps to
// build it. Uses the account of zyklus-doppelt.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Doppelkonto';

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('a shortcut gets its access, books with the amount alone and is revoked', async ({
	page,
	playwright
}) => {
	await login(page);
	await page.goto('/mehr');
	await page.getByRole('link', { name: 'iOS Kurzbefehle' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'iOS Kurzbefehle' })).toBeVisible();
	// The steps are there before anything is created.
	const guide = page.getByRole('region', { name: 'Anleitung: nur Betrag' });
	await expect(guide.getByRole('listitem').first()).toContainText('Kurzbefehle');
	await expect(guide).toContainText('Inhalte von URL abrufen');
	await expect(page.getByRole('region', { name: 'Fertiger Kurzbefehl' })).toContainText(
		'die Apple signiert hat'
	);

	await page.getByLabel('Name').fill('Testhandy');
	await page.getByLabel('Bucht auf').selectOption({ label: ACCOUNT });
	await page.getByRole('button', { name: 'Zugang anlegen' }).click();
	const created = page.getByRole('region', { name: 'Neuer Zugang' });
	const url = (await created.getByTestId('shortcut-url').textContent())!.trim();
	const header = (await created.getByTestId('shortcut-header').textContent())!.trim();
	expect(url).toMatch(/\/api\/v1\/shortcut$/);
	expect(header).toMatch(/^Bearer [A-Za-z0-9_-]{20,}$/);
	const access = page.getByRole('region', { name: 'Zugänge' }).getByRole('listitem', {
		name: 'Testhandy'
	});
	await expect(access).toContainText(`bucht auf ${ACCOUNT}`);
	await expect(access).toContainText('noch nicht benutzt');

	// The simple shortcut sends the amount only, as text with a comma.
	const api = await playwright.request.newContext();
	const headers = { authorization: header };
	let res = await api.post(url, { headers, data: { amount: '4,20' } });
	expect(res.status()).toBe(200);
	const body = (await res.json()) as { message: string };
	expect(body.message.replace(/\u00a0/g, ' ')).toContain('4,20 € ');
	expect(body.message).toContain(`gebucht (${ACCOUNT})`);
	// The list for the extended shortcut.
	res = await api.get(url, { headers });
	expect(((await res.json()) as { options: string[] }).options).toContain('Ohne Kategorie');

	await page.goto('/buchungen?q=per%20Kurzbefehl');
	await expect(
		page.getByRole('main').getByRole('link', { name: /per Kurzbefehl.*4,20/ })
	).toHaveCount(1);

	// Revoked, the shortcut is locked out.
	await page.goto('/kurzbefehle');
	await expect(access).not.toContainText('noch nicht benutzt');
	await access.getByRole('button', { name: 'Widerrufen' }).click();
	await expect(page.getByRole('status')).toHaveText('Zugang widerrufen.');
	await expect(access).toHaveCount(0);
	res = await api.post(url, { headers, data: { amount: '1' } });
	expect(res.status()).toBe(401);
	await api.dispose();
});
