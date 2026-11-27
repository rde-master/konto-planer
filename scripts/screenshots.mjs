// Screenshots for README and docs from a running demo instance (DEMO_MODE=true).
// Usage: BASE_URL=http://localhost:4191 node scripts/screenshots.mjs
import { mkdir } from 'node:fs/promises';
import { chromium, devices } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4191';
const OUT = 'docs/screenshots';

const pages = [
	{ name: 'uebersicht', path: '/' },
	{ name: 'konto', path: '/konten', click: /Gemeinschaftskonto/ },
	{ name: 'dauerposten', path: '/dauerposten' },
	{ name: 'buchungen', path: '/buchungen' },
	{ name: 'auswertungen', path: '/auswertungen' },
	{ name: 'finanzfluss', path: '/finanzfluss' },
	{ name: 'widgets', path: '/widgets' }
];

const variants = [
	{ suffix: 'handy-hell', options: { ...devices['iPhone 13'], colorScheme: 'light' } },
	{ suffix: 'handy-dunkel', options: { ...devices['iPhone 13'], colorScheme: 'dark' } },
	{ suffix: 'desktop', options: { viewport: { width: 1280, height: 860 }, colorScheme: 'light' } }
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
for (const v of variants) {
	const context = await browser.newContext(v.options);
	const page = await context.newPage();
	// After an update the app shows "Was ist neu" once – close it before taking pictures.
	await page.goto(BASE + '/');
	await page
		.getByRole('dialog', { name: 'Was ist neu' })
		.getByRole('button', { name: 'Fertig' })
		.click({ timeout: 2000 })
		.catch(() => {});
	for (const p of pages) {
		await page.goto(BASE + p.path);
		if (p.click) await page.getByRole('link', { name: p.click }).first().click();
		await page.waitForLoadState('networkidle');
		// The demo banner is not part of the screenshots.
		await page.addStyleTag({ content: '[role="note"]{display:none!important}' });
		await page.waitForTimeout(400);
		await page.screenshot({ path: `${OUT}/${p.name}-${v.suffix}.png` });
		console.log(`${OUT}/${p.name}-${v.suffix}.png`);
	}
	await context.close();
}
await browser.close();
