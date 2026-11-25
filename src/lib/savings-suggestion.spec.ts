import { describe, expect, it } from 'vitest';
import { goalShare, lastSalary, suggestedSaving } from './savings-suggestion';

describe('suggestedSaving', () => {
	it('rounds down to 10 €', () => {
		expect(suggestedSaving(45_678)).toBe(45_000);
		expect(suggestedSaving(1_000)).toBe(1_000);
	});
	it('suggests nothing below 10 €', () => {
		expect(suggestedSaving(999)).toBe(0);
		expect(suggestedSaving(-5_000)).toBe(0);
	});
});

describe('lastSalary', () => {
	const dues = [
		{ dueDate: '2026-10-30', bookingDate: '2026-10-30', status: 'booked' as const },
		{ dueDate: '2026-11-30', bookingDate: '2026-11-30', status: 'provisional' as const },
		{ dueDate: '2026-12-30', bookingDate: '2026-12-30', status: 'provisional' as const }
	];
	it('takes the latest one up to today', () => {
		expect(lastSalary(dues, '2026-11-29')?.dueDate).toBe('2026-10-30');
		expect(lastSalary(dues, '2026-11-30')?.dueDate).toBe('2026-11-30');
	});
	it('ignores skipped ones', () => {
		const skipped = dues.map((d) =>
			d.dueDate === '2026-11-30' ? { ...d, status: 'skipped' as const } : d
		);
		expect(lastSalary(skipped, '2026-12-05')?.dueDate).toBe('2026-10-30');
		expect(lastSalary([], '2026-12-05')).toBeNull();
	});
});

describe('goalShare', () => {
	it('fills the goal up to its target', () => {
		expect(goalShare(30_000, { allocated: 10_000, targetAmount: 100_000 })).toBe(30_000);
		expect(goalShare(30_000, { allocated: 90_000, targetAmount: 100_000 })).toBe(10_000);
		expect(goalShare(30_000, { allocated: 100_000, targetAmount: 100_000 })).toBe(0);
	});
});
