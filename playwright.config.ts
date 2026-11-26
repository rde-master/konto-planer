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
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'retain-on-failure',
		locale: 'de-DE',
		timezoneId: 'Europe/Berlin'
	},
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
		env: {
			DATABASE_URL,
			PORT: String(PORT),
			ORIGIN: `http://localhost:${PORT}`,
			BODY_SIZE_LIMIT: '12M',
			ATTACHMENT_DIR: 'test-results/attachments',
			// Local stand-in for the browser push services (zustellung.e2e.ts).
			PUSH_TEST_ORIGIN: 'http://127.0.0.1:18124',
			// Stand-in for company websites and the favicon service (firmenlogos-web.e2e.ts).
			LOGO_TEST_BASE: 'http://127.0.0.1:18126'
		}
	}
});
