import type { Page } from '@playwright/test';

/** Opens a tab ("Reiter") of the page: long pages show one part at a time. */
export async function openTab(page: Page, name: string) {
	await page.getByRole('tab', { name, exact: true }).click();
}

/**
 * Opens a notification rule on the admin page (tab "Meldungen"; every rule is folded until it
 * is tapped) and returns its section.
 */
export async function openRule(page: Page, name: string) {
	await openTab(page, 'Meldungen');
	const rule = page.getByRole('region', { name: `Meldungsregel ${name}`, exact: true });
	if ((await rule.locator('details').getAttribute('open')) === null)
		await rule.locator('summary').click();
	return rule;
}
