import { expect, test } from '@playwright/test';
import pkg from '../../package.json' with { type: 'json' };

// "Frameworks und Bibliotheken" in the settings: what the app is built with, with versions.
const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };

test('the settings list frameworks and libraries with their versions', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');

	await page.goto('/einstellungen');
	await page.getByRole('link', { name: 'Frameworks und Bibliotheken' }).click();
	await expect(
		page.getByRole('heading', { level: 1, name: 'Frameworks und Bibliotheken' })
	).toBeVisible();
	await expect(page.getByRole('main')).toContainText(`Konto Planer ${pkg.version}`);

	// What the app runs on right now.
	const runtime = page.getByRole('region', { name: 'Laufzeit' });
	await expect(
		runtime.getByRole('listitem', { name: 'Node.js' }).locator('[data-version]')
	).toHaveText(/^\d+\.\d+\.\d+$/);
	await expect(
		runtime.getByRole('listitem', { name: 'PostgreSQL' }).locator('[data-version]')
	).toHaveText(/^\d+\.\d+/);

	// Frameworks, libraries and tools – every direct dependency is there, with an exact version.
	const frameworks = page.getByRole('region', { name: 'Frameworks' });
	const kit = frameworks.getByRole('listitem', { name: 'SvelteKit', exact: true });
	await expect(kit.locator('[data-version]')).toHaveText(/^\d+\.\d+\.\d+/);
	await expect(kit).toContainText('@sveltejs/kit');
	await expect(kit).toContainText('MIT');
	await expect(kit.getByRole('link')).toHaveAttribute(
		'href',
		'https://www.npmjs.com/package/@sveltejs/kit'
	);
	await expect(
		page
			.getByRole('region', { name: 'Bibliotheken' })
			.getByRole('listitem', { name: 'Apache ECharts' })
	).toContainText('Grafiken');
	await expect(
		page
			.getByRole('region', { name: 'Entwicklung und Tests' })
			.getByRole('listitem', { name: 'Playwright' })
	).toBeVisible();
	const direct = Object.keys(pkg.dependencies).length + Object.keys(pkg.devDependencies).length;
	await expect(page.locator('main section:not([aria-label="Laufzeit"]) li')).toHaveCount(direct);
});
