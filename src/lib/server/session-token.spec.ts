import { describe, expect, it } from 'vitest';
import {
	SESSION_LIFETIME_MS,
	generateSessionToken,
	hashSessionToken,
	isExpired,
	needsRenewal,
	newExpiry
} from './session-token';

const DAY = 24 * 60 * 60 * 1000;

describe('session tokens', () => {
	it('generates unique, url-safe tokens with 256 bits of entropy', () => {
		const a = generateSessionToken();
		const b = generateSessionToken();
		expect(a).not.toBe(b);
		expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	it('hashes deterministically and never returns the token itself', () => {
		const token = generateSessionToken();
		expect(hashSessionToken(token)).toBe(hashSessionToken(token));
		expect(hashSessionToken(token)).not.toContain(token);
		expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe('session lifetime', () => {
	const now = Date.UTC(2026, 10, 23);

	it('lasts 400 days, the maximum browsers allow for cookies', () => {
		expect(newExpiry(now).getTime() - now).toBe(400 * DAY);
		expect(SESSION_LIFETIME_MS).toBe(400 * DAY);
	});

	it('is expired exactly at the expiry time', () => {
		expect(isExpired(new Date(now + 1), now)).toBe(false);
		expect(isExpired(new Date(now), now)).toBe(true);
	});

	it('renews once more than 30 days have passed, so active devices stay logged in', () => {
		const fresh = newExpiry(now);
		expect(needsRenewal(fresh, now + 29 * DAY)).toBe(false);
		expect(needsRenewal(fresh, now + 31 * DAY)).toBe(true);
	});
});
