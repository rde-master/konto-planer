import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const DATABASE_URL =
	process.env.E2E_DATABASE_URL ??
	'postgres://kontoplaner:kontoplaner@localhost:5432/kontoplaner_e2e';

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
	projects: [
		{
			name: 'iphone',
			use: { ...devices['iPhone 15'], defaultBrowserType: 'chromium' }
		}
	],
	webServer: {
		command: 'node scripts/e2e-reset-db.mjs && node build',
		port: PORT,
		reuseExistingServer: false,
		env: { DATABASE_URL, PORT: String(PORT), ORIGIN: `http://localhost:${PORT}` }
	}
});
