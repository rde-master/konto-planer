import { expect, test, type Page } from '@playwright/test';

// Desktop layout: wide pages flow in two columns, phones and reading pages stay single.
const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

const columns = (page: Page) =>
	page.evaluate(() => {
		const el = document.querySelector('.kp-columns');
		return el ? getComputedStyle(el).columnCount : 'none';
	});

test('one column on the phone', async ({ page }) => {
	await login(page);
	await page.goto('/einstellungen');
	expect(await columns(page)).toBe('auto');
});

test.describe('desktop', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('two columns on wide screens, reading pages stay narrow', async ({ page }) => {
		await login(page);
		await page.goto('/einstellungen');
		expect(await columns(page)).toBe('2');
		// Both columns are used: some section starts in the right half.
		const lefts = await page
			.locator('.kp-columns section')
			.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
		expect(new Set(lefts).size).toBeGreaterThan(1);

		await page.goto('/hilfe/erste-schritte');
		expect(await columns(page)).toBe('none');
	});

	test('actions look like buttons: coloured, with the hand cursor', async ({ page }) => {
		await login(page);
		await page.goto('/einstellungen');
		const action = page.getByRole('button', { name: 'Passwort ändern' });
		const entry = page.getByText('Benutzername', { exact: true });
		const style = (l: typeof action, prop: 'color' | 'cursor') =>
			l.evaluate((e, p) => getComputedStyle(e.querySelector('span.flex-1') ?? e)[p], prop);
		expect(await action.evaluate((e) => getComputedStyle(e).cursor)).toBe('pointer');
		// The action row is coloured differently from a plain entry.
		expect(await style(action, 'color')).not.toBe(await style(entry, 'color'));
		// Hovering highlights the row.
		const before = await action.evaluate((e) => getComputedStyle(e).backgroundColor);
		await action.hover();
		await expect
			.poll(() => action.evaluate((e) => getComputedStyle(e).backgroundColor))
			.not.toBe(before);
	});

	test('three columns on very wide screens', async ({ page }) => {
		await page.setViewportSize({ width: 2000, height: 1100 });
		await login(page);
		await page.goto('/einstellungen');
		expect(await columns(page)).toBe('3');
	});
});
