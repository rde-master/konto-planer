import { describe, expect, it } from 'vitest';
import { balanceOn, days360, installmentsOf, interestUntil, loanPlan } from './loans';
import type { Schedule } from './recurring';

const monthly: Schedule = {
	interval: 'monthly',
	customEvery: null,
	customUnit: null,
	startDate: '2026-02-15',
	endDate: null
};

describe('days360', () => {
	it('counts every month as 30 days', () => {
		expect(days360('2026-01-15', '2026-02-15')).toBe(30);
		expect(days360('2026-01-31', '2026-02-28')).toBe(28);
		expect(days360('2026-01-01', '2027-01-01')).toBe(360);
	});
});

describe('loanPlan', () => {
	const installments = installmentsOf(
		monthly,
		[{ amount: 500_00, validFrom: '2026-02-15' }],
		'2026-01-15'
	);

	it('splits each installment into interest and repayment (30/360)', () => {
		const plan = loanPlan({
			principal: 10_000_00,
			rate: 6000,
			startDate: '2026-01-15',
			installments,
			extras: []
		});
		// 10.000 € × 6 % / 12 = 50 € interest, 450 € repayment.
		expect(plan.rows[0]).toEqual({
			date: '2026-02-15',
			payment: 500_00,
			interest: 50_00,
			repayment: 450_00,
			extra: 0,
			balance: 9_550_00
		});
		expect(plan.rows[1].interest).toBe(4775);
		// Paid off after 22 installments; the last one is smaller.
		expect(plan.paidOff).toBe('2027-11-15');
		expect(plan.lastPayment).toBeLessThan(500_00);
		expect(plan.rows.at(-1)?.balance).toBe(0);
		const paid = plan.rows.reduce((s, r) => s + r.payment, 0);
		expect(paid - plan.totalInterest).toBe(10_000_00);
		expect(balanceOn(plan, 10_000_00, '2026-02-14')).toBe(10_000_00);
		expect(balanceOn(plan, 10_000_00, '2026-03-20')).toBe(plan.rows[1].balance);
		expect(interestUntil(plan, '2026-03-15')).toBe(50_00 + 4775);
	});

	it('extra repayments lower the debt and shorten the term', () => {
		const base = { principal: 10_000_00, rate: 6000, startDate: '2026-01-15', installments };
		const without = loanPlan({ ...base, extras: [] });
		const withExtra = loanPlan({ ...base, extras: [{ date: '2026-03-01', amount: 2_000_00 }] });
		expect(withExtra.rows.find((r) => r.extra)).toMatchObject({ extra: 2_000_00 });
		expect(withExtra.paidOff! < without.paidOff!).toBe(true);
		expect(withExtra.totalInterest).toBeLessThan(without.totalInterest);
	});

	it('flags installments that do not cover the interest', () => {
		const plan = loanPlan({
			principal: 100_000_00,
			rate: 10_000,
			startDate: '2026-01-15',
			installments: installments.slice(0, 3),
			extras: []
		});
		expect(plan.growing).toBe(true);
		expect(plan.paidOff).toBeNull();
		expect(plan.rows.at(-1)!.balance).toBeGreaterThan(100_000_00);
	});

	it('an end date of the item leaves a remaining debt', () => {
		const ending = installmentsOf(
			{ ...monthly, endDate: '2026-06-30' },
			[{ amount: 500_00, validFrom: '2026-02-15' }],
			'2026-01-15'
		);
		const plan = loanPlan({
			principal: 10_000_00,
			rate: 6000,
			startDate: '2026-01-15',
			installments: ending,
			extras: []
		});
		expect(plan.rows).toHaveLength(5);
		expect(plan.paidOff).toBeNull();
		expect(plan.rows.at(-1)!.balance).toBeGreaterThan(0);
	});
});
