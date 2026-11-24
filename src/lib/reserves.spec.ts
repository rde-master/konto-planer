import { describe, expect, it } from 'vitest';
import {
	isReserveItem,
	nextMonthStart,
	previousDue,
	reserveRate,
	suggestedReserve
} from './reserves';
import type { Schedule } from './recurring';

const base = { customEvery: null, customUnit: null } as const;

describe('isReserveItem', () => {
	it('takes expenses every three months or less often', () => {
		expect(isReserveItem({ ...base, kind: 'expense', interval: 'yearly' })).toBe(true);
		expect(isReserveItem({ ...base, kind: 'expense', interval: 'quarterly' })).toBe(true);
		expect(isReserveItem({ ...base, kind: 'expense', interval: 'semiannual' })).toBe(true);
		expect(isReserveItem({ ...base, kind: 'expense', interval: 'monthly' })).toBe(false);
		expect(isReserveItem({ ...base, kind: 'expense', interval: 'once' })).toBe(false);
		expect(isReserveItem({ ...base, kind: 'income', interval: 'yearly' })).toBe(false);
		expect(isReserveItem({ ...base, kind: 'transfer', interval: 'yearly' })).toBe(false);
	});
	it('custom intervals from three months on', () => {
		const custom = (every: number, unit: 'day' | 'week' | 'month') => ({
			kind: 'expense',
			interval: 'custom' as const,
			customEvery: every,
			customUnit: unit
		});
		expect(isReserveItem(custom(2, 'month'))).toBe(false);
		expect(isReserveItem(custom(4, 'month'))).toBe(true);
		expect(isReserveItem(custom(12, 'week'))).toBe(false);
		expect(isReserveItem(custom(13, 'week'))).toBe(true);
		expect(isReserveItem(custom(90, 'day'))).toBe(true);
	});
});

describe('reserveRate', () => {
	it('spreads the amount over the months of the period', () => {
		expect(reserveRate(600_00, { ...base, interval: 'yearly' })).toBe(50_00);
		expect(reserveRate(90_00, { ...base, interval: 'quarterly' })).toBe(30_00);
		expect(reserveRate(100_00, { ...base, interval: 'yearly' })).toBe(833);
	});
});

describe('suggestedReserve', () => {
	const yearly: Schedule = { ...base, interval: 'yearly', startDate: '2025-03-01', endDate: null };

	it('is the elapsed share of the period', () => {
		expect(previousDue(yearly, '2027-03-01')).toBe('2026-03-01');
		// 2026-03-01 → 2026-09-01: 184 of 365 days.
		expect(suggestedReserve(365_00, yearly, '2027-03-01', '2026-09-01')).toBe(184_00);
		expect(suggestedReserve(365_00, yearly, '2027-03-01', '2026-03-01')).toBe(0);
	});
	it('is 0 before the first due date', () => {
		expect(previousDue(yearly, '2025-03-01')).toBeNull();
		expect(suggestedReserve(600_00, yearly, '2025-03-01', '2025-01-15')).toBe(0);
	});
});

describe('nextMonthStart', () => {
	it('is the first of the next month', () => {
		expect(nextMonthStart('2026-11-24')).toBe('2026-12-01');
		expect(nextMonthStart('2026-12-31')).toBe('2027-01-01');
	});
});
