import { describe, expect, it } from 'vitest';
import { balanceAsOf, isStale, needsImport, reminderDay } from './import-reminder';

describe('reminderDay', () => {
	it('is the 30th, in February the last day', () => {
		expect(reminderDay('2026-11-03')).toBe('2026-11-30');
		expect(reminderDay('2027-01-31')).toBe('2027-01-30');
		expect(reminderDay('2027-02-10')).toBe('2027-02-28');
		expect(reminderDay('2028-02-10')).toBe('2028-02-29');
	});
});

describe('needsImport', () => {
	it('from the reminder day on, when the last import is older than 14 days', () => {
		expect(needsImport('2026-11-29', '2026-10-01')).toBe(false);
		expect(needsImport('2026-11-30', '2026-10-01')).toBe(true);
		expect(needsImport('2026-12-31', '2026-12-01')).toBe(true);
		expect(needsImport('2026-11-30', '2026-11-20')).toBe(false);
	});
	it('never for accounts without imports', () => {
		expect(needsImport('2026-11-30', null)).toBe(false);
	});
});

describe('balanceAsOf', () => {
	it('prefers the import, then an adjustment, then the opening date', () => {
		expect(balanceAsOf('2026-11-20', '2026-11-24', '2026-01-01')).toEqual({
			date: '2026-11-20',
			source: 'import'
		});
		expect(balanceAsOf(null, '2026-11-24', '2026-01-01').source).toBe('adjustment');
		expect(balanceAsOf(null, '2025-12-01', '2026-01-01').source).toBe('opening');
	});
	it('is stale after 30 days', () => {
		expect(isStale('2026-10-26', '2026-11-26')).toBe(true);
		expect(isStale('2026-10-27', '2026-11-26')).toBe(false);
	});
});
