import type { Page } from '@playwright/test';

/** Opens a tab ("Reiter") of the page: long pages show one part at a time. */
export async function openTab(page: Page, name: string) {
	await page.getByRole('tab', { name, exact: true }).click();
}
