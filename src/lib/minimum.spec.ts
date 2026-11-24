import { describe, expect, it } from 'vitest';
import { minimumPlan, monthEnd, resolveCutoff } from './minimum';

const today = '2026-11-24';

describe('resolveCutoff', () => {
	it('month end: this month, on the last day the next one', () => {
		expect(monthEnd('2026-02-10')).toBe('2026-02-28');
		expect(resolveCutoff('month_end', today, {})).toEqual({
			date: '2026-11-30',
			mode: 'month_end',
			fallback: null
		});
		expect(resolveCutoff('month_end', '2026-11-30', {}).date).toBe('2026-12-31');
	});
	it('salary falls back to the month end without a salary', () => {
		expect(resolveCutoff('salary', today, { nextSalary: '2026-12-01' }).date).toBe('2026-12-01');
		expect(resolveCutoff('salary', today, { nextSalary: null })).toEqual({
			date: '2026-11-30',
			mode: 'month_end',
			fallback: 'no_salary'
		});
	});
	it('a free date must lie in the future', () => {
		expect(resolveCutoff('date', today, { date: '2026-12-15' }).date).toBe('2026-12-15');
		expect(resolveCutoff('date', today, { date: today }).fallback).toBe('date_passed');
	});
});

describe('minimumPlan', () => {
	const ev = (date: string, amount: number, label = 'x') => ({ date, amount, label });

	it('takes the deepest point until the cut-off, including the cut-off day', () => {
		const plan = minimumPlan(
			500_00,
			0,
			[
				ev('2026-11-25', -300_00, 'Miete'),
				ev('2026-11-27', 100_00, 'Umbuchung'),
				ev('2026-11-28', -350_00, 'Versicherung'),
				ev('2026-12-01', -50_00, 'Handy'),
				ev('2026-12-02', -999_00, 'nach Stichtag'),
				ev(today, -1_00, 'heute schon gebucht')
			],
			'2026-12-01',
			today
		);
		expect(plan.minimum).toBe(600_00);
		expect(plan.available).toBe(-100_00);
		expect(plan.lowest).toEqual({ date: '2026-12-01', balance: -100_00 });
		expect(plan.goesNegative).toBe(true);
		expect(plan.exceedsOverdraft).toBe(true);
		expect(plan.steps.map((s) => s.label)).toEqual(['Miete', 'Umbuchung', 'Versicherung', 'Handy']);
	});
	it('on the same day outgoing payments count before incoming ones', () => {
		const plan = minimumPlan(
			100_00,
			500_00,
			[ev('2026-11-26', 200_00, 'Eingang'), ev('2026-11-26', -150_00, 'Lastschrift')],
			'2026-11-30',
			today
		);
		expect(plan.minimum).toBe(150_00);
		expect(plan.lowest).toEqual({ date: '2026-11-26', balance: -50_00 });
		expect(plan.exceedsOverdraft).toBe(false);
	});
	it('no drop: minimum 0, everything available', () => {
		const plan = minimumPlan(250_00, 0, [ev('2026-11-26', 100_00)], '2026-11-30', today);
		expect(plan).toMatchObject({ minimum: 0, available: 250_00, goesNegative: false });
	});
	it('overdraft in use today', () => {
		const plan = minimumPlan(-120_00, 1000_00, [], '2026-11-30', today);
		expect(plan).toMatchObject({
			overdraftInUse: true,
			goesNegative: false,
			exceedsOverdraft: false,
			minimum: 0,
			available: -120_00
		});
	});
	it('the buffer always adds to the minimum', () => {
		const none = minimumPlan(250_00, 0, [], '2026-11-30', today, 100_00);
		expect(none).toMatchObject({ minimum: 100_00, buffer: 100_00, available: 150_00 });
		const drop = minimumPlan(250_00, 0, [ev('2026-11-26', -200_00)], '2026-11-30', today, 100_00);
		expect(drop).toMatchObject({ minimum: 300_00, available: -50_00, goesNegative: false });
	});
});
