import { describe, expect, it } from 'vitest';
import {
	freeAmount,
	monthsUntil,
	nextGoalDue,
	progress,
	savingRate,
	transferAmount
} from './goals';
import { validateAllocation, validateGoal, type GoalInput } from './server/goal-rules';
import type { Schedule } from './recurring';

describe('monthsUntil', () => {
	it('counts whole months, at least one', () => {
		expect(monthsUntil('2026-11-24', '2027-06-15')).toBe(6);
		expect(monthsUntil('2026-11-24', '2027-06-24')).toBe(7);
		expect(monthsUntil('2026-11-24', '2026-12-01')).toBe(1);
		expect(monthsUntil('2026-11-24', '2026-11-24')).toBe(1);
	});
});

describe('savingRate', () => {
	it('spreads the missing amount over the months, rounded up', () => {
		expect(savingRate(100_000, 10_000, '2026-11-24', '2027-06-15')).toBe(15_000);
		expect(savingRate(100_00, 0, '2026-01-01', '2026-04-01')).toBe(3334);
	});
	it('is 0 when reached and null without a usable date', () => {
		expect(savingRate(500, 500, '2026-01-01', null)).toBe(0);
		expect(savingRate(500, 100, '2026-01-01', null)).toBeNull();
		expect(savingRate(500, 100, '2026-05-01', '2026-04-01')).toBeNull();
	});
});

describe('amounts', () => {
	it('progress, transfer and free amount', () => {
		expect(progress(1000, 250)).toBe(0.25);
		expect(progress(1000, 2000)).toBe(1);
		expect(transferAmount(300, 1000)).toBe(300);
		expect(transferAmount(1500, 1000)).toBe(1000);
		expect(freeAmount(1000, [300, 200])).toBe(500);
		expect(freeAmount(100, [300])).toBe(-200);
	});
});

describe('nextGoalDue', () => {
	const yearly: Schedule = {
		interval: 'yearly',
		customEvery: null,
		customUnit: null,
		startDate: '2025-03-01',
		endDate: null,
		pauseFrom: null,
		pauseUntil: null
	};
	const amounts = [{ amount: 60_000, validFrom: '2025-03-01' }];

	it('skips due items that already got a transfer; shifted to the bank day', () => {
		// 1 March 2026 is a Sunday.
		expect(nextGoalDue(yearly, amounts, '2026-01-10', new Set())).toEqual({
			dueDate: '2026-03-01',
			bookingDate: '2026-03-02',
			amount: 60_000
		});
		expect(nextGoalDue(yearly, amounts, '2026-03-02', new Set(['2026-03-01']))?.dueDate).toBe(
			'2027-03-01'
		);
	});

	it('is null for a one-off payment that is over', () => {
		const once = { ...yearly, interval: 'once' as const, startDate: '2026-02-02' };
		expect(nextGoalDue(once, amounts, '2026-03-01', new Set())).toBeNull();
		expect(nextGoalDue(once, amounts, '2026-02-02', new Set(['2026-02-02']))).toBeNull();
	});
});

describe('validateGoal', () => {
	const base: GoalInput = {
		name: ' Urlaub  Sommer ',
		targetAmount: '',
		targetDate: '',
		recurringId: '',
		allocated: ''
	};
	const ctx = {
		today: '2026-11-24',
		free: 50_000,
		payments: new Map([
			['p1', { amount: 120_000, next: '2027-06-01' }],
			['old', { amount: 5_000, next: null }]
		])
	};

	it('takes the target amount from the linked payment', () => {
		const r = validateGoal({ ...base, recurringId: 'p1', targetDate: '2027-01-01' }, ctx);
		expect(r.values).toEqual({
			name: 'Urlaub Sommer',
			targetAmount: 120_000,
			targetDate: null,
			recurringId: 'p1',
			allocated: 0
		});
	});

	it('needs an amount without a payment; the date is optional but not in the past', () => {
		expect(validateGoal(base, ctx).errors?.targetAmount).toBeDefined();
		const ok = validateGoal({ ...base, targetAmount: '3.000' }, ctx);
		expect(ok.values?.targetDate).toBeNull();
		expect(
			validateGoal({ ...base, targetAmount: '3.000', targetDate: '2026-11-23' }, ctx).errors
				?.targetDate
		).toBe('Das Zieldatum darf nicht in der Vergangenheit liegen.');
	});

	it('rejects unknown or finished payments', () => {
		expect(validateGoal({ ...base, recurringId: 'x' }, ctx).errors?.recurringId).toBeDefined();
		expect(validateGoal({ ...base, recurringId: 'old' }, ctx).errors?.recurringId).toBe(
			'Die Zahlung hat keine Fälligkeit mehr.'
		);
	});

	it('limits the allocation to the free balance and the target', () => {
		expect(
			validateGoal({ ...base, targetAmount: '3.000', allocated: '600' }, ctx).errors?.allocated
		).toMatch(/^Auf dem Sparbuch sind nur 500,00\s€ frei\.$/);
		expect(validateAllocation('40', { free: 50_000, target: 3_000 }).error).toBe(
			'Höchstens der Zielbetrag.'
		);
		expect(validateAllocation('', { free: 0, target: 3_000 })).toEqual({ value: 0, error: null });
		expect(validateAllocation('-1', { free: 0, target: 3_000 }).error).toBeDefined();
	});
});
