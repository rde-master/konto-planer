import { describe, expect, it } from 'vitest';
import {
	dayHeat,
	expensesByCategory,
	fixedCostsByMonth,
	heatLevel,
	inOutByMonth,
	monthRange,
	monthsBack,
	priceChanges,
	savingsRate,
	yearCalendar,
	type FixedItem,
	type ReportBooking
} from './reports';

const cats = [
	{ id: 'food', name: 'Lebensmittel', color: 'green', parentId: null },
	{ id: 'super', name: 'Supermarkt', color: null, parentId: 'food' },
	{ id: 'home', name: 'Wohnen', color: 'orange', parentId: null }
];

function b(over: Partial<ReportBooking>): ReportBooking {
	return {
		id: 'x',
		bookingDate: '2026-03-10',
		amount: -10_00,
		categoryId: null,
		parts: [],
		internal: false,
		label: 'x',
		...over
	};
}

describe('months', () => {
	it('ranges and lists of months', () => {
		expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
		expect(monthsBack('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
	});
});

describe('expensesByCategory', () => {
	it('groups subcategories under their main category; splits count by part', () => {
		const result = expensesByCategory(
			[
				b({ amount: -50_00, categoryId: 'super' }),
				b({ amount: -20_00, categoryId: 'food' }),
				b({
					amount: -100_00,
					categoryId: 'home',
					parts: [{ amount: -30_00, categoryId: 'super' }]
				}),
				b({ amount: 5_00, categoryId: 'super' }),
				b({ amount: -999_00, categoryId: 'home', internal: true }),
				b({ amount: -7_00 })
			],
			cats
		);
		expect(result.map((r) => [r.name, r.amount])).toEqual([
			['Lebensmittel', 95_00],
			['Wohnen', 70_00],
			['Ohne Kategorie', 7_00]
		]);
		expect(result[0].children).toEqual([{ id: 'super', name: 'Supermarkt', amount: 75_00 }]);
	});
});

describe('income and expenses', () => {
	it('per month, without internal transfers', () => {
		expect(
			inOutByMonth(
				[
					b({ bookingDate: '2026-01-05', amount: 2_000_00 }),
					b({ bookingDate: '2026-01-06', amount: -500_00 }),
					b({ bookingDate: '2026-01-07', amount: -200_00, internal: true }),
					b({ bookingDate: '2026-02-01', amount: -100_00 })
				],
				['2026-01', '2026-02']
			)
		).toEqual([
			{ month: '2026-01', income: 2_000_00, expenses: 500_00 },
			{ month: '2026-02', income: 0, expenses: 100_00 }
		]);
		expect(savingsRate(2_000_00, 500_00)).toBe(0.75);
		expect(savingsRate(0, 10)).toBeNull();
	});
});

const base: FixedItem = {
	id: 'i',
	name: 'Item',
	kind: 'expense',
	categoryId: 'home',
	interval: 'monthly',
	customEvery: null,
	customUnit: null,
	startDate: '2026-01-15',
	endDate: null,
	amounts: [{ amount: 800_00, validFrom: '2026-01-15' }]
};

describe('fixedCostsByMonth', () => {
	it('monthly equivalents with the amount valid at the end of the month', () => {
		const items: FixedItem[] = [
			{ ...base, amounts: [...base.amounts, { amount: 850_00, validFrom: '2026-03-01' }] },
			{
				...base,
				id: 'ins',
				interval: 'yearly',
				categoryId: null,
				amounts: [{ amount: 120_00, validFrom: '2026-01-15' }]
			},
			{ ...base, id: 'once', interval: 'once' },
			{ ...base, id: 'salary', kind: 'income' }
		];
		const r = fixedCostsByMonth(items, ['2025-12', '2026-02', '2026-03']);
		expect(r.map((m) => m.amount)).toEqual([0, 810_00, 860_00]);
		expect(r[2].byCategory.get('home')).toBe(850_00);
	});
});

describe('priceChanges', () => {
	it('total and yearly change, only past amounts', () => {
		const r = priceChanges(
			[
				{
					id: 'a',
					name: 'Strom',
					amounts: [
						{ amount: 100_00, validFrom: '2024-01-01' },
						{ amount: 121_00, validFrom: '2026-01-01' },
						{ amount: 200_00, validFrom: '2027-01-01' }
					]
				},
				{ id: 'b', name: 'Gleich', amounts: [{ amount: 5, validFrom: '2025-01-01' }] }
			],
			'2026-06-01'
		);
		expect(r).toHaveLength(1);
		expect(r[0].change).toBeCloseTo(0.21);
		expect(r[0].perYear).toBeCloseTo(0.1, 2);
	});
});

describe('calendar', () => {
	it('due payments per month with the largest ones', () => {
		const items: FixedItem[] = [
			{ ...base, amounts: [{ amount: 10_00, validFrom: '2026-01-15' }] },
			{
				...base,
				id: 'ins',
				name: 'Versicherung',
				interval: 'yearly',
				startDate: '2026-03-02',
				amounts: [{ amount: 300_00, validFrom: '2026-03-02' }]
			},
			{
				...base,
				id: 'sal',
				name: 'Lohn',
				kind: 'income',
				amounts: [{ amount: 2_000_00, validFrom: '2026-01-15' }]
			}
		];
		const cal = yearCalendar(items, 2026);
		expect(cal[2]).toMatchObject({ month: '2026-03', expenses: 310_00, income: 2_000_00 });
		expect(cal[2].top[0]).toMatchObject({ name: 'Versicherung', amount: 300_00 });
	});

	it('day heat: bookings until today, planned payments after', () => {
		const days = dayHeat(
			'2026-03',
			[
				b({ bookingDate: '2026-03-10', amount: -40_00, label: 'Markt' }),
				b({ bookingDate: '2026-03-10', amount: 9_00 })
			],
			[{ ...base, startDate: '2026-01-20', amounts: [{ amount: 15_00, validFrom: '2026-01-20' }] }],
			'2026-03-12'
		);
		expect(days).toHaveLength(31);
		expect(days[9]).toMatchObject({ date: '2026-03-10', amount: 40_00, planned: false });
		expect(days[19]).toMatchObject({ date: '2026-03-20', amount: 15_00, planned: true });
		expect(heatLevel(40_00, 40_00)).toBe(4);
		expect(heatLevel(5_00, 40_00)).toBe(1);
		expect(heatLevel(0, 40_00)).toBe(0);
	});
});
