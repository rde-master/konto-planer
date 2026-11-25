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
const today = todayBerlin();

const mails: { to: string; data: string }[] = [];
const haCalls: { path: string; auth: string | undefined; body: string }[] = [];
let ha: Server;
let smtp: SMTPServer;

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
});

test.afterAll(async () => {
	await new Promise<void>((resolve) => ha.close(() => resolve()));
	await new Promise<void>((resolve) => smtp.close(() => resolve()));
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
	await sheet.getByLabel('Bezeichnung').fill('Zeitung Melde');
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
