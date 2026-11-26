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

	test('three columns on very wide screens', async ({ page }) => {
		await page.setViewportSize({ width: 2000, height: 1100 });
		await login(page);
		await page.goto('/einstellungen');
		expect(await columns(page)).toBe('3');
	});
});
