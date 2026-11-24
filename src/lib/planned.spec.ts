import { describe, expect, it } from 'vitest';
import {
	amountBefore,
	changeDelta,
	formatDiff,
	formatPercent,
	monthlySteps,
	plannedChanges,
	type PlannedEntry
} from './planned';

const monthly = { interval: 'monthly', customEvery: null, customUnit: null } as const;
const yearly = { interval: 'yearly', customEvery: null, customUnit: null } as const;

const entries = [
	{ amount: 2999, validFrom: '2026-01-01' },
	{ amount: 3499, validFrom: '2027-01-01' },
	{ amount: 2500, validFrom: '2026-07-01' },
	{ amount: 3999, validFrom: '2028-01-01' }
];

describe('changeDelta', () => {
	it('computes difference and percentage with one decimal', () => {
		expect(changeDelta(2999, 3499)).toEqual({ diff: 500, percent: 16.7 });
		expect(changeDelta(10000, 9500)).toEqual({ diff: -500, percent: -5 });
		expect(changeDelta(0, 500)).toEqual({ diff: 500, percent: null });
	});
});

describe('plannedChanges', () => {
	it('lists future changes with the amount before, oldest first', () => {
		expect(plannedChanges(entries, '2026-11-24')).toEqual([
			{ validFrom: '2027-01-01', previous: 2500, amount: 3499, diff: 999, percent: 40 },
			{ validFrom: '2028-01-01', previous: 3499, amount: 3999, diff: 500, percent: 14.3 }
		]);
	});
	it('a change on today is no longer planned', () => {
		expect(plannedChanges(entries, '2027-01-01').map((c) => c.validFrom)).toEqual(['2028-01-01']);
	});
	it('ignores changes after the end and the first entry of a future item', () => {
		expect(plannedChanges(entries, '2026-11-24', '2027-06-30')).toHaveLength(1);
		expect(plannedChanges([{ amount: 100, validFrom: '2030-01-01' }], '2026-11-24')).toEqual([]);
	});
});

describe('amountBefore', () => {
	it('takes the latest entry starting before the day', () => {
		expect(amountBefore(entries, '2027-01-01')).toBe(2500);
		expect(amountBefore(entries, '2027-01-02')).toBe(3499);
		expect(amountBefore(entries, '2026-01-01')).toBeNull();
	});
});

describe('monthlySteps', () => {
	const rent: PlannedEntry = {
		amounts: [
			{ amount: 80000, validFrom: '2025-01-01' },
			{ amount: 85000, validFrom: '2027-01-01' }
		],
		endDate: null,
		schedule: monthly,
		sign: -1
	};
	const insurance: PlannedEntry = {
		amounts: [
			{ amount: 12000, validFrom: '2025-01-01' },
			{ amount: 24000, validFrom: '2027-01-01' }
		],
		endDate: null,
		schedule: yearly,
		sign: -1
	};
	const salary: PlannedEntry = {
		amounts: [
			{ amount: 300000, validFrom: '2025-01-01' },
			{ amount: 310000, validFrom: '2027-04-01' }
		],
		endDate: null,
		schedule: monthly,
		sign: 1
	};

	it('adds up monthly differences per day and keeps a running total', () => {
		const steps = monthlySteps([rent, insurance, salary], '2026-11-24', {
			expense: 81000,
			income: 300000
		});
		expect(steps).toEqual([
			{ from: '2027-01-01', expense: 87000, income: 300000, expenseDiff: 6000, incomeDiff: 0 },
			{ from: '2027-04-01', expense: 87000, income: 310000, expenseDiff: 0, incomeDiff: 10000 }
		]);
	});
	it('nothing planned, nothing to show', () => {
		expect(monthlySteps([rent], '2027-01-01', { expense: 85000, income: 0 })).toEqual([]);
	});
});

describe('formatting', () => {
	it('shows signs explicitly', () => {
		expect(formatDiff(500)).toMatch(/^\+5,00\s€$/);
		expect(formatDiff(-250)).toMatch(/^−2,50\s€$/);
		expect(formatDiff(0)).toMatch(/^±0,00\s€$/);
		expect(formatPercent(16.7)).toBe('+16,7 %');
		expect(formatPercent(-5)).toBe('−5 %');
	});
});
