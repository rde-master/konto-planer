import { describe, expect, it } from 'vitest';
import { daysLeft, expired } from './trash';

describe('trash retention', () => {
	const deleted = new Date('2026-11-01T10:00:00Z');
	it('counts the days left', () => {
		expect(daysLeft(deleted, new Date('2026-11-01T10:00:00Z'))).toBe(30);
		expect(daysLeft(deleted, new Date('2026-11-30T11:00:00Z'))).toBe(1);
		expect(daysLeft(deleted, new Date('2026-12-05T00:00:00Z'))).toBe(0);
	});
	it('expires after 30 days', () => {
		expect(expired(deleted, new Date('2026-12-01T09:59:59Z'))).toBe(false);
		expect(expired(deleted, new Date('2026-12-01T10:00:00Z'))).toBe(true);
	});
});
