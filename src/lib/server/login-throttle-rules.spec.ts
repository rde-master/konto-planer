import { describe, expect, it } from 'vitest';
import {
	FAILURE_MEMORY_MS,
	formatLockedUntil,
	isLocked,
	lockDurationAfter,
	lockMessage,
	previousFailures
} from './login-throttle-rules';

const MIN = 60 * 1000;

describe('lockDurationAfter', () => {
	it('does not lock before the 5th failure', () => {
		for (const n of [0, 1, 2, 3, 4, 6, 9]) expect(lockDurationAfter(n)).toBeNull();
	});

	it('escalates 15 minutes, 1 hour, then 24 hours', () => {
		expect(lockDurationAfter(5)).toBe(15 * MIN);
		expect(lockDurationAfter(10)).toBe(60 * MIN);
		expect(lockDurationAfter(15)).toBe(24 * 60 * MIN);
		expect(lockDurationAfter(40)).toBe(24 * 60 * MIN);
	});
});

describe('previousFailures', () => {
	const now = Date.UTC(2026, 10, 23, 12);

	it('continues counting recent failures', () => {
		expect(previousFailures(4, new Date(now - 10 * MIN), now)).toBe(4);
	});

	it('starts over after 24 hours without failures', () => {
		expect(previousFailures(4, new Date(now - FAILURE_MEMORY_MS - 1), now)).toBe(0);
		expect(previousFailures(4, null, now)).toBe(0);
	});
});

describe('isLocked', () => {
	const now = Date.UTC(2026, 10, 23, 12);
	it('is locked only until the lock ends', () => {
		expect(isLocked(new Date(now + 1), now)).toBe(true);
		expect(isLocked(new Date(now), now)).toBe(false);
		expect(isLocked(null, now)).toBe(false);
	});
});

describe('formatLockedUntil', () => {
	// 23.11.2026 12:00 UTC = 13:00 Berlin (CET)
	const now = Date.UTC(2026, 10, 23, 12);

	it('shows only the time when the lock ends today (Berlin time)', () => {
		expect(formatLockedUntil(new Date(now + 15 * MIN), now)).toBe('13:15 Uhr');
	});

	it('includes the date when the lock ends on another day', () => {
		expect(formatLockedUntil(new Date(now + 24 * 60 * MIN), now)).toBe('24.11., 13:00 Uhr');
	});

	it('uses summer time in summer', () => {
		const summer = Date.UTC(2026, 6, 1, 10); // 12:00 CEST
		expect(formatLockedUntil(new Date(summer + 15 * MIN), summer)).toBe('12:15 Uhr');
	});

	it('builds the login message', () => {
		expect(lockMessage(new Date(now + 15 * MIN), now)).toBe(
			'Zu viele Fehlversuche. Anmeldung wieder möglich ab 13:15 Uhr.'
		);
	});
});
