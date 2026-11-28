import { createECDH, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { SMTPServer } from 'smtp-server';
import { expect, test, type Page } from '@playwright/test';
import { todayBerlin } from '../../src/lib/dates';
import { addDays, addMonths } from '../../src/lib/recurring';

// Notifications: SMTP and Home Assistant are local test servers started by this file.
test.describe.configure({ mode: 'serial' });

const ADMIN = { username: 'erika', password: 'sehr-geheim-123', name: 'Erika Muster' };
const ACCOUNT = 'Meldekonto';
const HA_PORT = 18123;
const SMTP_PORT = 12525;
const PUSH = 'http://127.0.0.1:18124';
const today = todayBerlin();

const mails: { to: string; data: string }[] = [];
const haCalls: { path: string; auth: string | undefined; body: string }[] = [];
let ha: Server;
let smtp: SMTPServer;
let push: Server;
const pushCalls: { path: string; encoding?: string; auth?: string; size: number }[] = [];

test.beforeAll(async () => {
	ha = createServer((req, res) => {
		let body = '';
		req.on('data', (c: Buffer) => (body += c.toString()));
		req.on('end', () => {
			haCalls.push({ path: req.url ?? '', auth: req.headers.authorization, body });
			if (req.headers.authorization !== 'Bearer ha-test-token') {
				res.writeHead(401).end();
				return;
			}
			res.setHeader('content-type', 'application/json');
			if (req.url === '/api/services')
				res.end(
					JSON.stringify([{ domain: 'notify', services: { mobile_app_testphone: {}, notify: {} } }])
				);
			else res.end(JSON.stringify({ message: 'API running.' }));
		});
	});
	await new Promise<void>((resolve) => ha.listen(HA_PORT, '127.0.0.1', resolve));
	smtp = new SMTPServer({
		authOptional: true,
		disabledCommands: ['STARTTLS'],
		onData(stream, session, callback) {
			let data = '';
			stream.on('data', (c: Buffer) => (data += c.toString()));
			stream.on('end', () => {
				mails.push({ to: session.envelope.rcptTo.map((r) => r.address).join(','), data });
				callback();
			});
		}
	});
	await new Promise<void>((resolve) => smtp.listen(SMTP_PORT, '127.0.0.1', resolve));
	// Push service: accepts everything, except a device it no longer knows ("gone").
	push = createServer((req, res) => {
		let size = 0;
		req.on('data', (c: Buffer) => (size += c.length));
		req.on('end', () => {
			pushCalls.push({
				path: req.url ?? '',
				encoding: req.headers['content-encoding'],
				auth: req.headers.authorization,
				size
			});
			res.writeHead(req.url?.endsWith('/gone') ? 410 : 201).end();
		});
	});
	await new Promise<void>((resolve) => push.listen(18124, '127.0.0.1', resolve));
});

test.afterAll(async () => {
	await new Promise<void>((resolve) => ha.close(() => resolve()));
	await new Promise<void>((resolve) => smtp.close(() => resolve()));
	await new Promise<void>((resolve) => push.close(() => resolve()));
});

async function login(page: Page) {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Benutzername').fill(ADMIN.username);
	await page.getByLabel('Passwort', { exact: true }).fill(ADMIN.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL('/');
}

test('SMTP and Home Assistant are set up and tested', async ({ page }) => {
	await login(page);
	await page.goto('/einstellungen/benutzer');
	await page.getByRole('link', { name: new RegExp(ADMIN.name) }).click();
	await page.getByLabel('E-Mail (optional)').fill('erika@example.org');
	await page.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Änderungen gesichert.');

	await page.goto('/einstellungen');
	await page.getByRole('link', { name: 'Benachrichtigungen', exact: true }).click();
	const mail = page.getByRole('region', { name: 'E-Mail' });
	await mail.getByLabel('Server', { exact: true }).fill('kein server');
	await mail.getByRole('button', { name: 'E-Mail sichern' }).click();
	await expect(mail.getByText('Bitte einen gültigen Servernamen eingeben.')).toBeVisible();
	await mail.getByLabel('Server', { exact: true }).fill('127.0.0.1');
	await mail.getByLabel('Port', { exact: true }).fill(String(SMTP_PORT));
	await mail.getByLabel('Absender').fill('Konto Planer <konto@example.org>');
	await mail.getByRole('button', { name: 'E-Mail sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('E-Mail-Einstellungen gesichert.');
	await page.getByRole('button', { name: /^Test-E-Mail an mich/ }).click();
	await expect(page.getByRole('status')).toHaveText('Test-E-Mail verschickt.');
	expect(mails.at(-1)?.to).toBe('erika@example.org');

	const haRegion = page.getByRole('region', { name: 'Home Assistant' });
	await haRegion.getByLabel('Adresse').fill(`http://127.0.0.1:${HA_PORT}`);
	await haRegion.getByLabel('Zugriffstoken (langlebig)').fill('ha-test-token');
	await haRegion.getByRole('button', { name: 'Home Assistant sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Home-Assistant-Einstellungen gesichert.');
	await page.getByRole('button', { name: 'Verbindung testen' }).click();
	await expect(page.getByRole('status')).toHaveText('Home Assistant ist erreichbar.');
	// The token is stored, but never shown again.
	await expect(haRegion.getByLabel('Zugriffstoken (langlebig)')).toHaveValue('');
});

test('each user picks their Home Assistant devices', async ({ page }) => {
	await login(page);
	await page.goto('/einstellungen/meine-benachrichtigungen');
	await page.getByLabel('mobile_app_testphone').check();
	await page.getByRole('button', { name: 'Geräte sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Geräte gesichert.');
	await page.getByRole('button', { name: 'Testnachricht senden' }).click();
	await expect(page.getByRole('status')).toHaveText('Testnachricht verschickt.');
	expect(haCalls.some((c) => c.path === '/api/services/notify/mobile_app_testphone')).toBe(true);
});

test('a near notice deadline is sent once by e-mail and Home Assistant', async ({ page }) => {
	await login(page);
	await page.goto('/konten');
	await page.getByRole('button', { name: 'Konto anlegen' }).click();
	const account = page.getByRole('dialog', { name: 'Neues Konto' });
	await account.getByLabel('Name').fill(ACCOUNT);
	await account.getByLabel('Betrag in €').fill('100');
	await account.getByLabel('Stand am').fill(addDays(today, -3));
	await account.getByRole('button', { name: 'Anlegen' }).click();
	await expect(account).toBeHidden();

	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill('Zeitung Melde');
	await sheet.getByLabel('Betrag in €').fill('25');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Erste Fälligkeit').fill(addDays(today, 3));
	await sheet.getByRole('switch', { name: /Kündbarer Vertrag/ }).check();
	await sheet.getByLabel('Verlängerung', { exact: true }).selectOption({ label: 'Um feste Zeit' });
	await sheet.getByLabel('Laufzeit bis').fill(addDays(addMonths(today, 3), 10));
	await sheet.getByLabel('Kündigungsfrist', { exact: true }).fill('3');
	await sheet.getByLabel('Frist in').selectOption({ label: 'Monate' });
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await page.goto('/einstellungen/benachrichtigungen');
	const rule = page.getByRole('region', { name: 'Meldungsregel Kündigungsfrist endet bald' });
	await rule.getByRole('switch', { name: 'Über Home Assistant' }).check();
	await rule.getByRole('button', { name: 'Regel sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Meldungsregel gesichert.');

	await page.getByRole('button', { name: 'Jetzt prüfen und senden' }).click();
	await expect(page.getByRole('status')).toHaveText(/Meldungen? verschickt/);
	expect(mails.some((m) => m.data.includes('Zeitung Melde'))).toBe(true);
	expect(haCalls.some((c) => c.body.includes('Zeitung Melde'))).toBe(true);
	await expect(page.getByRole('list', { name: 'Zuletzt verschickt' })).toContainText(
		'Kündigungsfrist: Zeitung Melde'
	);

	// "Einmal": a second run sends nothing more.
	const before = mails.length;
	await page.getByRole('button', { name: 'Jetzt prüfen und senden' }).click();
	await expect(page.getByRole('status')).toHaveText('Keine Meldung fällig.');
	expect(mails.length).toBe(before);
});

test('an account in the red is reported', async ({ page }) => {
	await login(page);
	await page.goto('/buchungen');
	await page.getByRole('button', { name: 'Buchung erfassen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neue Buchung' });
	await sheet.getByLabel('Betrag in €').fill('250');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Empfänger/Zahler (optional)').fill('Reparatur Melde');
	await sheet.getByRole('button', { name: 'Buchen' }).click();
	await expect(sheet).toBeHidden();

	await page.goto('/einstellungen/benachrichtigungen');
	await expect(page.getByRole('region', { name: 'Meldungsregel Dispo erreicht' })).toBeVisible();
	await page.getByRole('button', { name: 'Jetzt prüfen und senden' }).click();
	await expect(page.getByRole('status')).toHaveText(/Meldungen? verschickt/);
	expect(mails.some((m) => m.data.includes('Dispo erreicht: Meldekonto'))).toBe(true);
	expect(mails.some((m) => m.data.includes('Mindestbestand unterschritten: Meldekonto'))).toBe(
		true
	);
});

function subscription(path: string) {
	const ecdh = createECDH('prime256v1');
	ecdh.generateKeys();
	return {
		endpoint: `${PUSH}/push/${path}`,
		expirationTime: null,
		keys: {
			p256dh: ecdh.getPublicKey().toString('base64url'),
			auth: randomBytes(16).toString('base64url')
		}
	};
}

const IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

test('a device gets push messages from the web app', async ({ page }) => {
	await login(page);
	await page.goto('/einstellungen/meine-benachrichtigungen');
	await expect(page.getByRole('region', { name: 'Push' })).toBeVisible();

	// Only known push services are accepted.
	const bad = await page.request.post('/api/push', {
		data: { ...subscription('x'), endpoint: 'https://evil.example/x' }
	});
	expect(bad.status()).toBe(400);

	// The browser hands its subscription to the app (here without a real push service).
	const ok = await page.request.post('/api/push', {
		data: subscription('phone'),
		headers: { 'user-agent': IPHONE }
	});
	expect(ok.ok()).toBe(true);
	await page.reload();
	const devices = page.getByRole('list', { name: 'Meine Push-Geräte' });
	await expect(devices).toContainText('iPhone · Safari');

	await page.getByRole('button', { name: 'Push-Test an meine Geräte' }).click();
	await expect(page.getByRole('status')).toHaveText('Push-Testnachricht verschickt.');
	const call = pushCalls.find((c) => c.path === '/push/phone');
	expect(call?.encoding).toBe('aes128gcm');
	expect(call?.auth).toMatch(/^vapid t=.+, k=.+/);
	expect(call?.size).toBeGreaterThan(0);

	// A rule sends by push, too.
	await page.goto('/einstellungen/benachrichtigungen');
	const rule = page.getByRole('region', { name: 'Meldungsregel Dispo erreicht' });
	await rule.getByRole('switch', { name: /^Push aus der Web-App/ }).check();
	await rule.getByRole('button', { name: 'Regel sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Meldungsregel gesichert.');
	const before = pushCalls.length;
	await page.getByRole('button', { name: 'Jetzt prüfen und senden' }).click();
	await expect(page.getByRole('status')).toHaveText(/verschickt/);
	expect(pushCalls.length).toBeGreaterThan(before);
	await expect(page.getByRole('list', { name: 'Zuletzt verschickt' })).toContainText(
		/Dispo erreicht: Meldekonto.*Push/s
	);
});

test('devices the push service no longer knows are removed', async ({ page }) => {
	await login(page);
	const gone = await page.request.post('/api/push', { data: subscription('gone') });
	expect(gone.ok()).toBe(true);
	await page.goto('/einstellungen/meine-benachrichtigungen');
	const devices = page.getByRole('list', { name: 'Meine Push-Geräte' });
	await expect(devices.getByRole('listitem')).toHaveCount(2);
	await page.getByRole('button', { name: 'Push-Test an meine Geräte' }).click();
	await expect(page.getByRole('status')).toHaveText('Push-Testnachricht verschickt.');
	await expect(devices.getByRole('listitem')).toHaveCount(1);

	await devices.getByRole('button', { name: 'iPhone · Safari entfernen' }).click();
	await expect(page.getByRole('status')).toHaveText('Gerät entfernt.');
	await expect(devices).toBeHidden();
});

test('a manual transfer is reminded until it is marked as transferred', async ({ page }) => {
	await login(page);
	await page.goto('/dauerposten');
	await page.getByRole('button', { name: 'Dauerposten anlegen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Neuer Dauerposten' });
	await sheet.getByLabel('Bezeichnung', { exact: true }).fill('Garagenmiete Melde');
	await sheet.getByLabel('Betrag in €').fill('80');
	await sheet.getByLabel('Konto').selectOption({ label: ACCOUNT });
	await sheet.getByLabel('Erste Fälligkeit').fill(today);
	await sheet.getByLabel('Empfänger (optional)').fill('Hausverwaltung Beispiel');
	await sheet.getByLabel('Zahlart').selectOption({ label: 'Manuelle Überweisung' });
	await sheet.getByRole('button', { name: 'Anlegen' }).click();
	await expect(sheet).toBeHidden();

	await page.goto('/einstellungen/benachrichtigungen');
	const rule = page.getByRole('region', { name: 'Meldungsregel Manuelle Überweisung fällig' });
	await expect(rule.getByLabel('Vorlauf (Bankarbeitstage)')).toHaveValue('1');
	await rule.getByLabel('Vorlauf (Bankarbeitstage)').fill('11');
	await rule.getByRole('button', { name: 'Regel sichern' }).click();
	await expect(page.getByRole('alert')).toHaveText('Vorlauf: 0 bis 10 Bankarbeitstage.');
	await rule.getByLabel('Vorlauf (Bankarbeitstage)').fill('2');
	await rule.getByText('Täglich bis erledigt').click();
	await rule.getByRole('button', { name: 'Regel sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Meldungsregel gesichert.');

	await page.getByRole('button', { name: 'Jetzt prüfen und senden' }).click();
	await expect(page.getByRole('status')).toHaveText(/verschickt/);
	expect(mails.some((m) => m.data.includes('Garagenmiete Melde'))).toBe(true);

	await page.goto('/');
	const row = page
		.getByRole('region', { name: 'Zu überweisen' })
		.getByRole('listitem', { name: 'Garagenmiete Melde' });
	await expect(row).toContainText('Hausverwaltung Beispiel');
	await expect(row).toContainText(/80,00\s€/);
	await row.getByRole('button', { name: 'Überwiesen' }).click();
	await expect(page.getByRole('status')).toHaveText('Garagenmiete Melde: als überwiesen abgehakt.');
	await expect(page.getByRole('region', { name: 'Zu überweisen' })).toBeHidden();

	// Done: even "daily until done" sends nothing more.
	await page.goto('/einstellungen/benachrichtigungen');
	const before = mails.length;
	await page.getByRole('button', { name: 'Jetzt prüfen und senden' }).click();
	await expect(page.getByRole('status')).toBeVisible();
	expect(mails.slice(before).some((m) => m.data.includes('Garagenmiete Melde'))).toBe(false);

	await page.goto('/einstellungen/protokoll?bereich=recurring');
	await expect(
		page.getByRole('button').filter({ hasText: 'Garagenmiete Melde' }).first()
	).toBeVisible();
});

test('the monthly report can be switched on and sent right away', async ({ page }) => {
	await login(page);
	await page.goto('/einstellungen/meine-benachrichtigungen');
	const report = page.getByRole('region', { name: 'Monatsbericht' });
	await report.getByRole('switch', { name: 'Monatsbericht per E-Mail' }).check();
	await report.getByRole('button', { name: 'Sichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Monatsbericht eingeschaltet.');
	await expect(report.getByRole('switch', { name: 'Monatsbericht per E-Mail' })).toBeChecked();

	const before = mails.length;
	await report.getByRole('button', { name: 'Bericht für den Vormonat jetzt senden' }).click();
	await expect(page.getByRole('status')).toHaveText('Monatsbericht verschickt.');
	const mail = mails.slice(before).at(-1);
	expect(mail?.to).toBe('erika@example.org');
	expect(mail?.data).toContain('text/html');
	expect(mail?.data).toContain('Einnahmen');
	expect(mail?.data).toContain(ACCOUNT);
});

test('a read-only API token delivers the status and can be revoked', async ({
	page,
	playwright
}) => {
	await login(page);
	await page.goto('/einstellungen');
	await page.getByRole('link', { name: 'API-Zugänge' }).click();
	await page.getByLabel('Name').fill('Home Assistant Test');
	await page.getByRole('button', { name: 'Zugang anlegen' }).click();
	await expect(page.getByRole('status')).toHaveText('API-Zugang angelegt.');
	const token = (await page.getByTestId('api-token').textContent())!.trim();
	await expect(page.getByTestId('ha-yaml')).toContainText('/api/v1/status');
	await expect(page.getByTestId('ha-yaml')).toContainText(`Bearer ${token}`);

	const api = await playwright.request.newContext();
	expect((await api.get('/api/v1/status')).status()).toBe(401);
	const res = await api.get('/api/v1/status', { headers: { authorization: `Bearer ${token}` } });
	expect(res.status()).toBe(200);
	const status = (await res.json()) as {
		accounts: { name: string; sensor: string; balance: number }[];
		warnings: { type: string; account: string }[];
	};
	const meldekonto = status.accounts.find((a) => a.name === ACCOUNT);
	expect(meldekonto?.sensor).toBe('meldekonto');
	expect(status.warnings.some((w) => w.type === 'overdraft_reached' && w.account === ACCOUNT)).toBe(
		true
	);

	await page
		.getByRole('listitem', { name: 'Home Assistant Test' })
		.getByRole('button', { name: 'Widerrufen' })
		.click();
	await expect(page.getByRole('status')).toHaveText('API-Zugang widerrufen.');
	expect(
		(await api.get('/api/v1/status', { headers: { authorization: `Bearer ${token}` } })).status()
	).toBe(401);
	await api.dispose();
});

test('the values are pushed to Home Assistant as sensors', async ({ page }) => {
	await login(page);
	await page.goto('/einstellungen/benachrichtigungen');
	const region = page.getByRole('region', { name: 'Home Assistant' });
	await region.getByRole('switch', { name: /Werte als Sensoren senden/ }).check();
	await region.getByRole('button', { name: 'Sichern und senden' }).click();
	await expect(page.getByRole('status')).toHaveText(/\d+ Sensoren an Home Assistant gesendet\./);
	const sensor = haCalls.find((c) => c.path === '/api/states/sensor.konto_planer_meldekonto_stand');
	expect(sensor?.auth).toBe('Bearer ha-test-token');
	expect(JSON.parse(sensor!.body)).toMatchObject({ attributes: { unit_of_measurement: '€' } });
	expect(haCalls.some((c) => c.path === '/api/states/sensor.konto_planer_verfuegbar')).toBe(true);
});

test('an iOS shortcut books with its own token', async ({ page, playwright }) => {
	await login(page);
	await page.goto('/einstellungen/api');
	await page.getByLabel('Name').fill('Kurzbefehl Test');
	await page.getByLabel('Zweck').selectOption({ label: 'Kurzbefehl (bucht)' });
	await page.getByLabel('Bucht auf').selectOption({ label: ACCOUNT });
	await page.getByRole('button', { name: 'Zugang anlegen' }).click();
	await expect(page.getByRole('status')).toHaveText('API-Zugang angelegt.');
	const token = (await page.getByTestId('api-token').textContent())!.trim();
	const url = (await page.getByTestId('shortcut-url').textContent())!.trim();
	expect(url).toMatch(/\/api\/v1\/shortcut$/);

	const api = await playwright.request.newContext();
	const headers = { authorization: `Bearer ${token}` };
	const options = ((await (await api.get(url, { headers })).json()) as { options: string[] })
		.options;
	const choice = options.find((o) => !o.startsWith('Vorlage:'))!;
	expect(choice).toBeTruthy();

	let res = await api.post(url, { headers, data: { amount: 12.8, choice, payee: 'Kiosk Kurz' } });
	expect(res.status()).toBe(200);
	const body = (await res.json()) as { message: string };
	expect(body.message.replace(/\u00a0/g, ' ')).toContain(`12,80 € `);
	expect(body.message).toContain(`gebucht (${ACCOUNT})`);

	res = await api.post(url, { headers, data: { amount: '12,80', choice: 'Gibt es nicht' } });
	expect(res.status()).toBe(400);

	// A read-only token may not book.
	await page.getByLabel('Name').fill('Nur lesen');
	await page.getByLabel('Zweck').selectOption({ label: 'Sonstiges' });
	await page.getByRole('button', { name: 'Zugang anlegen' }).click();
	await expect(page.getByTestId('api-token')).not.toHaveText(token);
	const reader = (await page.getByTestId('api-token').textContent())!.trim();
	res = await api.post(url, {
		headers: { authorization: `Bearer ${reader}` },
		data: { amount: 1, choice }
	});
	expect(res.status()).toBe(403);
	await api.dispose();

	await page.goto('/buchungen?q=Kiosk%20Kurz');
	await expect(page.getByRole('main').getByRole('link', { name: /Kiosk Kurz.*12,80/ })).toHaveCount(
		1
	);
});
