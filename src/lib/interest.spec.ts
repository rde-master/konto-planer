import { describe, expect, it } from 'vitest';
import { computeInterest, formatRate, parseRate, periodEnd, periodStart, rateOn } from './interest';

describe('rates', () => {
	it('parses and formats percent', () => {
		expect(parseRate('2,75')).toBe(2750);
		expect(parseRate('0.5 %')).toBe(500);
		expect(parseRate('3,125')).toBe(3125);
		expect(parseRate('abc')).toBeNull();
		expect(parseRate('101')).toBeNull();
		expect(formatRate(2750)).toBe('2,75 %');
		expect(formatRate(3125)).toBe('3,125 %');
	});
	it('takes the rate valid on the day', () => {
		const rates = [
			{ rate: 2000, validFrom: '2026-01-01' },
			{ rate: 2500, validFrom: '2026-07-01' }
		];
		expect(rateOn(rates, '2025-12-31')).toBe(0);
		expect(rateOn(rates, '2026-06-30')).toBe(2000);
		expect(rateOn(rates, '2026-07-01')).toBe(2500);
	});
});

describe('periods', () => {
	it('ends at month, quarter or year end', () => {
		expect(periodEnd('monthly', '2028-02-10')).toBe('2028-02-29');
		expect(periodEnd('quarterly', '2026-05-10')).toBe('2026-06-30');
		expect(periodEnd('quarterly', '2026-12-01')).toBe('2026-12-31');
		expect(periodEnd('yearly', '2026-05-10')).toBe('2026-12-31');
		expect(periodStart('quarterly', '2026-06-30')).toBe('2026-04-01');
		expect(periodStart('yearly', '2026-12-31')).toBe('2026-01-01');
	});
});

describe('computeInterest', () => {
	const base = {
		openingBalance: 10_000_00,
		rhythm: 'yearly' as const,
		rates: [{ rate: 3000, validFrom: '2025-01-01' }],
		events: []
	};
	it('a full year at 3 % on 10.000 € gives 300 €', () => {
		const r = computeInterest({ ...base, start: '2025-01-01', until: '2025-12-31' });
		expect(r.credits).toEqual([{ periodEnd: '2025-12-31', amount: 300_00 }]);
		expect(r.balance).toBe(10_300_00);
	});
	it('day-exact: half a year, deposits count from the end of their day', () => {
		const r = computeInterest({
			...base,
			start: '2025-07-01',
			until: '2025-12-31',
			events: [{ date: '2025-10-01', amount: 5_000_00 }]
		});
		// 10.000 € × 3 % × 184/365 + 5.000 € × 3 % × 92/365
		expect(r.credits[0].amount).toBe(
			Math.round((1_000_000 * 0.03 * 184) / 365 + (500_000 * 0.03 * 92) / 365)
		);
	});
	it('compounds quarterly and reports the running accrual', () => {
		const r = computeInterest({
			...base,
			rhythm: 'quarterly',
			start: '2025-01-01',
			until: '2025-07-15'
		});
		expect(r.credits.map((c) => c.periodEnd)).toEqual(['2025-03-31', '2025-06-30']);
		expect(r.credits[1].amount).toBeGreaterThan(r.credits[0].amount);
		expect(r.accrued).toBeGreaterThan(0);
	});
	it('fixed amounts replace the computed ones; 0 = skipped', () => {
		const r = computeInterest({
			...base,
			rhythm: 'quarterly',
			start: '2025-01-01',
			until: '2025-06-30',
			fixed: new Map([
				['2025-03-31', 70_00],
				['2025-06-30', 0]
			])
		});
		expect(r.credits).toEqual([{ periodEnd: '2025-03-31', amount: 70_00 }]);
	});
	it('no rate, no interest', () => {
		const r = computeInterest({ ...base, rates: [], start: '2025-01-01', until: '2025-12-31' });
		expect(r.credits).toEqual([]);
	});
});
