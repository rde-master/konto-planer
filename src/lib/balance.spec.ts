import { describe, expect, it } from 'vitest';
import { adjustmentAmount, balanceOn, countsToBalance } from './balance';

const account = { openingBalance: 100_00, openingDate: '2026-11-01' };
const bookings = [
	{ bookingDate: '2026-10-31', amount: -50_00 },
	{ bookingDate: '2026-11-01', amount: -10_00 },
	{ bookingDate: '2026-11-10', amount: 25_50 },
	{ bookingDate: '2026-11-20', amount: -3_20 }
];

describe('balanceOn', () => {
	it('adds bookings from the opening date on, inclusive', () => {
		expect(balanceOn(account, bookings, '2026-11-24')).toBe(100_00 - 10_00 + 25_50 - 3_20);
	});
	it('ignores bookings before the opening date', () => {
		expect(countsToBalance('2026-11-01', '2026-10-31')).toBe(false);
		expect(countsToBalance('2026-11-01', '2026-11-01')).toBe(true);
		expect(balanceOn(account, bookings, '2026-11-01')).toBe(90_00);
	});
	it('stops at the given day', () => {
		expect(balanceOn(account, bookings, '2026-11-10')).toBe(115_50);
		expect(balanceOn(account, [], '2026-11-24')).toBe(100_00);
	});
});

describe('adjustmentAmount', () => {
	it('is the difference to the actual balance', () => {
		expect(adjustmentAmount(112_30, 100_00)).toBe(-12_30);
		expect(adjustmentAmount(-5_00, 0)).toBe(5_00);
		expect(adjustmentAmount(42_00, 42_00)).toBe(0);
	});
});
