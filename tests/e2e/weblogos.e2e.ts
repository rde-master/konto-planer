import { createServer, type Server } from 'node:http';
import { expect, test, type Page } from '@playwright/test';

// Company logos from the web: a local server stands in for company websites and the
// favicon service (LOGO_TEST_BASE in playwright.config.ts).
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123' };
const ACCOUNT = 'Logokonto';
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64'
);
const requests: string[] = [];
let web: Server;

test.beforeAll(async () => {
	web = createServer((req, res) => {
		const url = req.url ?? '';
		requests.push(url);
		const html = (title: string, icon: string) => {
			res.setHeader('content-type', 'text/html; charset=utf-8');
			res.end(
				`<html><head><title>${title}</title><link rel="apple-touch-icon" href="${icon}"></head></html>`
			);
		};
		const png = () => {
			res.setHeader('content-type', 'image/png');
			res.end(PNG);
		};
		if (url === '/site/tegut.com/') html('tegut… gute Lebensmittel', '/touch.png');
		else if (url === '/site/tegut.com/touch.png') png();
		else if (url === '/site/musterladen.de/') html('Musterladen – alles für zu Hause', '/icon.png');
		else if (url === '/site/musterladen.de/icon.png') png();
		else if (url.startsWith('/site/www.google.com/s2/favicons?domain=nurgoogle-test.de')) png();
		else if (url === '/site/bilder-test.de/logo.png') png();
		else res.writeHead(404).end('nicht gefunden');
	});
	await new Promise<void>((resolve) => web.listen(18126, '127.0.0.1', resolve));
});

test.afterAll(async () => {
	await new Promise<void>((resolve) => web.close(() => resolve()));
});

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

async function book(page: Page, payee: string, amount: string) {
	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill(amount);
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill(payee);
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();
}

const logoOf = (page: Page, payee: string) =>
	page
		.getByRole('main')
		.getByRole('link', { name: new RegExp(payee) })
		.locator('img');

test('missing logos are found on company websites, never for people', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('500');
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();
	await book(page, 'tegut Markt Fulda', '23,40');
	await book(page, 'Musterladen GmbH', '12');
	await book(page, 'Erika Beispielfrau', '50');

	await page.goto('/einstellungen/system');
	await page.getByRole('button', { name: 'Fehlende Logos jetzt suchen' }).click();
	await expect(page.getByRole('status')).toHaveText('2 neue Logos gefunden.', { timeout: 20_000 });

	await page.goto('/buchungen?konto=' + (await accountId(page)));
	// Known brand → its website; company name → guessed website with matching title.
	await expect(logoOf(page, 'tegut Markt Fulda')).toHaveAttribute(
		'src',
		'/api/logos/web/tegut.com'
	);
	await expect(logoOf(page, 'Musterladen GmbH')).toHaveAttribute(
		'src',
		'/api/logos/web/musterladen.de'
	);
	await expect(logoOf(page, 'Erika Beispielfrau')).toHaveCount(0);
	expect(requests.some((r) => /erika|beispielfrau/i.test(r))).toBe(false);

	const res = await page.request.get('/api/logos/web/tegut.com');
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toBe('image/png');
	expect(res.headers()['content-security-policy']).toContain('sandbox');
	expect((await page.request.get('/api/logos/web/unbekannt.de')).status()).toBe(404);
});

async function accountId(page: Page): Promise<string> {
	await page.goto('/konten');
	const href = await page.getByRole('link', { name: new RegExp(ACCOUNT) }).getAttribute('href');
	return href!.split('/').pop()!;
}

test('a logo can be fetched by hand: website, favicon service or image address', async ({
	page
}) => {
	await login(page);
	await page.goto('/buchungen?q=Erika%20Beispielfrau');
	await page
		.getByRole('main')
		.getByRole('link', { name: /Erika Beispielfrau.*50,00/ })
		.click();
	await page.getByRole('button', { name: 'Logo ändern' }).click();
	const sheet = page.getByRole('dialog', { name: 'Logo' });
	const field = sheet.getByLabel('Webseite oder Bild-Adresse');

	await field.fill('keinlogo-test.de');
	await sheet.getByRole('button', { name: 'Holen' }).click();
	await expect(sheet.getByRole('alert')).toHaveText(
		'Auf keinlogo-test.de wurde kein Logo gefunden.'
	);

	// Nothing on the website itself, but the favicon service knows it.
	await field.fill('https://www.nurgoogle-test.de/');
	await sheet.getByRole('button', { name: 'Holen' }).click();
	await expect(sheet).toBeHidden();
	const header = page.getByRole('main').locator('img[src^="/api/logos/web/"]').first();
	await expect(header).toHaveAttribute('src', '/api/logos/web/nurgoogle-test.de');

	// The address of a picture from a web search.
	await page.getByRole('button', { name: 'Logo ändern' }).click();
	await field.fill('https://bilder-test.de/logo.png');
	await sheet.getByRole('button', { name: 'Holen' }).click();
	await expect(sheet).toBeHidden();
	await expect(header).toHaveAttribute('src', /^\/api\/logos\/web\/u-[0-9a-f]{20}$/);

	// Private addresses are never fetched.
	await page.getByRole('button', { name: 'Logo ändern' }).click();
	await field.fill('http://192.168.0.1/logo.png');
	await sheet.getByRole('button', { name: 'Holen' }).click();
	await expect(sheet.getByRole('alert')).toContainText('Bitte eine Webseite');
});
