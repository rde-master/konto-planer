import { describe, expect, it } from 'vitest';
import {
	clip,
	isPushoverKey,
	pushoverFault,
	pushoverFields,
	pushoverProblem,
	pushoverUrl
} from './pushover';

const TOKEN = 'a'.repeat(30);
const USER = 'U'.repeat(30);

describe('isPushoverKey', () => {
	it('takes 30 letters and digits only', () => {
		expect(isPushoverKey('azGDORePK8gMaC0QOYAMyEEuzJnyUi')).toBe(true);
		expect(isPushoverKey('azGDORePK8gMaC0QOYAMyEEuzJnyU')).toBe(false);
		expect(isPushoverKey('azGDORePK8gMaC0QOYAMyEEuzJnyUi1')).toBe(false);
		expect(isPushoverKey('azGDORePK8gMaC0QOYAMyEEuzJny-i')).toBe(false);
		expect(isPushoverKey('')).toBe(false);
	});
});

describe('clip', () => {
	it('keeps short texts and cuts long ones by character', () => {
		expect(clip('kurz', 10)).toBe('kurz');
		expect(clip('abcdef', 4)).toBe('abc…');
		// An emoji is one character, not two.
		expect(clip('😀😀😀', 3)).toBe('😀😀😀');
		expect([...clip('😀😀😀😀', 3)]).toHaveLength(3);
	});
});

describe('pushoverFields', () => {
	it('sends title, message and the page to open', () => {
		expect(
			pushoverFields({
				token: TOKEN,
				user: USER,
				title: 'Mindestbestand unterschritten',
				message: 'Girokonto: 120,00 € fehlen.',
				url: 'https://konto.example.org/konten/1'
			})
		).toEqual({
			token: TOKEN,
			user: USER,
			title: 'Mindestbestand unterschritten',
			message: 'Girokonto: 120,00 € fehlen.',
			url: 'https://konto.example.org/konten/1',
			url_title: 'Im Konto Planer öffnen'
		});
	});

	it('keeps to the limits of the API', () => {
		const f = pushoverFields({
			token: TOKEN,
			user: USER,
			title: 't'.repeat(300),
			message: 'm'.repeat(2000),
			url: `https://konto.example.org/${'x'.repeat(600)}`
		});
		expect([...f.title]).toHaveLength(250);
		expect([...f.message]).toHaveLength(1024);
		expect(f.url).toBeUndefined();
		expect(f.url_title).toBeUndefined();
	});

	it('never sends an empty message and no address that is none', () => {
		const f = pushoverFields({ token: TOKEN, user: USER, title: 'Test', message: '  ', url: 'x' });
		expect(f.message).toBe('Test');
		expect(f.url).toBeUndefined();
		expect(pushoverFields({ token: TOKEN, user: USER, title: '', message: '' }).title).toBe(
			'Konto Planer'
		);
	});
});

describe('pushoverUrl', () => {
	it('joins the public address of the app and the page', () => {
		expect(pushoverUrl('https://konto.example.org/', 'konten/1')).toBe(
			'https://konto.example.org/konten/1'
		);
		expect(pushoverUrl('http://192.168.1.5:3000', '/buchungen')).toBe(
			'http://192.168.1.5:3000/buchungen'
		);
		expect(pushoverUrl(undefined, 'konten')).toBeNull();
		expect(pushoverUrl('konto.example.org', 'konten')).toBeNull();
	});
});

describe('pushoverProblem', () => {
	it('accepts the answer of a sent message', () => {
		expect(pushoverProblem(200, { status: 1, request: 'r' })).toBeNull();
	});

	it('names a wrong token and a wrong user key', () => {
		expect(
			pushoverProblem(400, {
				token: 'invalid',
				errors: ['application token is invalid'],
				status: 0
			})
		).toBe('Pushover kennt das API-Token der Anwendung nicht.');
		expect(
			pushoverProblem(400, { user: 'invalid', errors: ['user identifier is invalid'], status: 0 })
		).toBe('Pushover kennt den Benutzerschlüssel nicht, oder es ist kein Gerät angemeldet.');
	});

	it('passes on other errors and the used-up quota', () => {
		expect(pushoverProblem(400, { status: 0, errors: ['message cannot be blank'] })).toBe(
			'Pushover meldet: message cannot be blank'
		);
		expect(pushoverProblem(429, { status: 0 })).toBe(
			'Das Monatskontingent bei Pushover ist aufgebraucht.'
		);
		expect(pushoverProblem(502, null)).toBe('Pushover antwortet mit 502.');
		// 200 without the confirmation is no success.
		expect(pushoverProblem(200, 'ok')).toBe('Pushover antwortet mit 200.');
	});
});

describe('pushoverFault', () => {
	it('tells a wrong token from a wrong user key', () => {
		expect(pushoverFault({ token: 'invalid', status: 0 })).toBe('token');
		expect(pushoverFault({ user: 'invalid', status: 0 })).toBe('user');
		expect(pushoverFault({ status: 0, errors: ['message cannot be blank'] })).toBeNull();
		expect(pushoverFault(null)).toBeNull();
	});
});
