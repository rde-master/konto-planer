import { describe, expect, it } from 'vitest';
import {
	addMonths,
	effectOn,
	amountOn,
	dueDates,
	intervalLabel,
	monthlyEquivalent,
	nextDue,
	type Schedule
} from './recurring';

const schedule = (over: Partial<Schedule>): Schedule => ({
	interval: 'monthly',
	customEvery: null,
	customUnit: null,
	startDate: '2026-01-31',
	endDate: null,
	...over
});

describe('addMonths', () => {
	it('clamps to the last day of shorter months', () => {
		expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
		expect(addMonths('2026-01-31', 3)).toBe('2026-04-30');
		expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
		expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
	});
});

describe('dueDates', () => {
	it('monthly on the 31st returns to the 31st after short months', () => {
		expect(dueDates(schedule({}), '2026-01-01', '2026-05-31')).toEqual([
			'2026-01-31',
			'2026-02-28',
			'2026-03-31',
			'2026-04-30',
			'2026-05-31'
		]);
	});

	it('quarterly, semiannual and yearly', () => {
		const s = { startDate: '2026-02-15' };
		expect(dueDates(schedule({ ...s, interval: 'quarterly' }), '2026-01-01', '2026-12-31')).toEqual(
			['2026-02-15', '2026-05-15', '2026-08-15', '2026-11-15']
		);
		expect(
			dueDates(schedule({ ...s, interval: 'semiannual' }), '2026-01-01', '2027-12-31')
		).toEqual(['2026-02-15', '2026-08-15', '2027-02-15', '2027-08-15']);
		expect(
			dueDates(
				schedule({ startDate: '2024-02-29', interval: 'yearly' }),
				'2024-01-01',
				'2028-12-31'
			)
		).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
	});

	it('weekly and custom intervals', () => {
		expect(
			dueDates(
				schedule({ startDate: '2026-11-02', interval: 'weekly' }),
				'2026-11-10',
				'2026-11-30'
			)
		).toEqual(['2026-11-16', '2026-11-23', '2026-11-30']);
		const every10Days = schedule({
			startDate: '2026-12-28',
			interval: 'custom',
			customEvery: 10,
			customUnit: 'day'
		});
		expect(dueDates(every10Days, '2026-12-01', '2027-01-31')).toEqual([
			'2026-12-28',
			'2027-01-07',
			'2027-01-17',
			'2027-01-27'
		]);
		const every4Weeks = { ...every10Days, customEvery: 4, customUnit: 'week' as const };
		expect(dueDates(every4Weeks, '2027-01-01', '2027-03-01')).toEqual(['2027-01-25', '2027-02-22']);
		const every2Months = { ...every10Days, customEvery: 2, customUnit: 'month' as const };
		expect(dueDates(every2Months, '2027-01-01', '2027-06-30')).toEqual([
			'2027-02-28',
			'2027-04-28',
			'2027-06-28'
		]);
	});

	it('respects start, end and one-off items', () => {
		const s = schedule({ startDate: '2026-03-01', endDate: '2026-05-01' });
		expect(dueDates(s, '2026-01-01', '2026-12-31')).toEqual([
			'2026-03-01',
			'2026-04-01',
			'2026-05-01'
		]);
		const once = schedule({ startDate: '2026-07-10', interval: 'once' });
		expect(dueDates(once, '2026-01-01', '2026-12-31')).toEqual(['2026-07-10']);
		expect(dueDates(once, '2026-07-11', '2026-12-31')).toEqual([]);
	});

	it('jumps far ahead without drifting', () => {
		const s = schedule({});
		expect(dueDates(s, '2036-02-01', '2036-03-31')).toEqual(['2036-02-29', '2036-03-31']);
		const weekly = schedule({ startDate: '2026-01-05', interval: 'weekly' });
		expect(dueDates(weekly, '2030-01-01', '2030-01-10')).toEqual(['2030-01-07']);
	});
});

describe('nextDue', () => {
	it('returns today, the next date or null after the end', () => {
		const s = schedule({ startDate: '2026-01-15', endDate: '2026-12-31' });
		expect(nextDue(s, '2026-11-15')).toBe('2026-11-15');
		expect(nextDue(s, '2026-11-16')).toBe('2026-12-15');
		expect(nextDue(s, '2026-12-16')).toBeNull();
		expect(nextDue(s, '2025-06-01')).toBe('2026-01-15');
	});
});

describe('amountOn', () => {
	const entries = [
		{ amount: 1200, validFrom: '2026-07-01' },
		{ amount: 1000, validFrom: '2026-01-01' },
		{ amount: 1500, validFrom: '2027-01-01' }
	];
	it('picks the latest entry on or before the day', () => {
		expect(amountOn(entries, '2026-06-30')).toBe(1000);
		expect(amountOn(entries, '2026-07-01')).toBe(1200);
		expect(amountOn(entries, '2027-03-01')).toBe(1500);
		// Before the first entry: the earliest amount.
		expect(amountOn(entries, '2025-01-01')).toBe(1000);
		expect(amountOn([], '2026-01-01')).toBeNull();
	});
});

describe('monthlyEquivalent and labels', () => {
	it('normalises to a month', () => {
		expect(
			monthlyEquivalent(12000, { interval: 'yearly', customEvery: null, customUnit: null })
		).toBe(1000);
		expect(
			monthlyEquivalent(3000, { interval: 'quarterly', customEvery: null, customUnit: null })
		).toBe(1000);
		expect(
			monthlyEquivalent(1000, { interval: 'weekly', customEvery: null, customUnit: null })
		).toBe(4333);
		expect(
			monthlyEquivalent(2000, { interval: 'custom', customEvery: 2, customUnit: 'month' })
		).toBe(1000);
		expect(monthlyEquivalent(5000, { interval: 'once', customEvery: null, customUnit: null })).toBe(
			0
		);
	});

	it('labels intervals in German', () => {
		expect(intervalLabel({ interval: 'monthly', customEvery: null, customUnit: null })).toBe(
			'monatlich'
		);
		expect(intervalLabel({ interval: 'custom', customEvery: 2, customUnit: 'month' })).toBe(
			'alle 2 Monate'
		);
		expect(intervalLabel({ interval: 'custom', customEvery: 1, customUnit: 'week' })).toBe(
			'jede Woche'
		);
		expect(intervalLabel({ interval: 'custom', customEvery: 1, customUnit: 'day' })).toBe(
			'jeden Tag'
		);
	});
});

describe('effectOn', () => {
	const transfer = { kind: 'transfer' as const, accountId: 'giro', targetAccountId: 'savings' };
	it('counts a transfer out on the source and in on the target', () => {
		expect(effectOn(transfer, 'giro', 5000)).toBe(-5000);
		expect(effectOn(transfer, 'savings', 5000)).toBe(5000);
		expect(effectOn(transfer, 'other', 5000)).toBe(0);
	});
	it('signs income and expenses on their own account only', () => {
		const expense = { kind: 'expense' as const, accountId: 'giro', targetAccountId: null };
		expect(effectOn(expense, 'giro', 100)).toBe(-100);
		expect(effectOn({ ...expense, kind: 'income' }, 'giro', 100)).toBe(100);
		expect(effectOn(expense, 'savings', 100)).toBe(0);
	});
});
