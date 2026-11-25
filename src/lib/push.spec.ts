import { describe, expect, it } from 'vitest';
import { deviceLabel, isPushEndpoint, parseSubscription, pushPayload } from './push';

const KEY =
	'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';

describe('isPushEndpoint', () => {
	it('accepts the push services over https', () => {
		expect(isPushEndpoint('https://web.push.apple.com/QGuQyavXut')).toBe(true);
		expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
		expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
		expect(isPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
	});
	it('rejects other hosts, http and ports', () => {
		expect(isPushEndpoint('https://evil.example/push.apple.com')).toBe(false);
		expect(isPushEndpoint('https://push.apple.com.evil.example/x')).toBe(false);
		expect(isPushEndpoint('http://web.push.apple.com/x')).toBe(false);
		expect(isPushEndpoint('https://web.push.apple.com:8443/x')).toBe(false);
		expect(isPushEndpoint('http://127.0.0.1:9/x')).toBe(false);
		expect(isPushEndpoint('kein url')).toBe(false);
	});
	it('allows the test origin only when set', () => {
		expect(isPushEndpoint('http://127.0.0.1:18124/push/1', 'http://127.0.0.1:18124')).toBe(true);
		expect(isPushEndpoint('http://127.0.0.1:18125/push/1', 'http://127.0.0.1:18124')).toBe(false);
	});
});

describe('parseSubscription', () => {
	it('reads a browser subscription', () => {
		const s = parseSubscription({
			endpoint: 'https://web.push.apple.com/x',
			expirationTime: null,
			keys: { p256dh: KEY, auth: 'tBHItJI5svbpez7KI4CCXg' }
		});
		expect(s).toEqual({
			endpoint: 'https://web.push.apple.com/x',
			keys: { p256dh: KEY, auth: 'tBHItJI5svbpez7KI4CCXg' }
		});
	});
	it('rejects missing or odd keys', () => {
		expect(parseSubscription(null)).toBeNull();
		expect(parseSubscription({ endpoint: 'https://web.push.apple.com/x' })).toBeNull();
		expect(
			parseSubscription({
				endpoint: 'https://web.push.apple.com/x',
				keys: { p256dh: 'a b', auth: 'tBHItJI5svbpez7KI4CCXg' }
			})
		).toBeNull();
	});
});

describe('deviceLabel', () => {
	it('names device and browser', () => {
		expect(
			deviceLabel(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
			)
		).toBe('iPhone · Safari');
		expect(
			deviceLabel(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0'
			)
		).toBe('Windows · Edge');
		expect(deviceLabel(null)).toBe('Gerät');
	});
});

describe('pushPayload', () => {
	it('carries title, text and the page to open', () => {
		expect(JSON.parse(pushPayload('Titel', 'Text', '/konten/1'))).toEqual({
			title: 'Titel',
			body: 'Text',
			url: '/konten/1'
		});
	});
	it('cuts long texts', () => {
		const p = JSON.parse(pushPayload('T', 'x'.repeat(500), '/')) as { body: string };
		expect(p.body).toHaveLength(400);
		expect(p.body.endsWith('…')).toBe(true);
	});
});
