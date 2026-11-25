import { describe, expect, it } from 'vitest';
import { budgetState, categoryFamily, monthProgress, spentIn } from './budgets';
import type { ReportBooking } from './reports';

const cats = [
	{ id: 'food', name: 'Lebensmittel', color: 'green', parentId: null },
	{ id: 'super', name: 'Supermarkt', color: null, parentId: 'food' },
	{ id: 'home', name: 'Wohnen', color: 'orange', parentId: null }
];

const b = (over: Partial<ReportBooking>): ReportBooking => ({
	id: 'x',
	bookingDate: '2026-11-10',
	amount: -10_00,
	categoryId: null,
	parts: [],
	internal: false,
	label: 'x',
	...over
});

describe('budgets', () => {
	it('spent in a main category includes subcategories, split parts and refunds', () => {
		const family = categoryFamily('food', cats);
		expect([...family]).toEqual(['food', 'super']);
		expect(
			spentIn(family, [
				b({ amount: -40_00, categoryId: 'super' }),
				b({ amount: -100_00, categoryId: 'home', parts: [{ amount: -25_00, categoryId: 'food' }] }),
				b({ amount: 5_00, categoryId: 'super' }),
				b({ amount: -99_00, categoryId: 'food', internal: true })
			])
		).toBe(60_00);
		expect(spentIn(family, [b({ amount: 5_00, categoryId: 'food' })])).toBe(0);
	});

	it('state and pace of the month', () => {
		expect(budgetState(79, 100)).toBe('ok');
		expect(budgetState(80, 100)).toBe('warn');
		expect(budgetState(101, 100)).toBe('over');
		expect(monthProgress('2026-11-15', '2026-11')).toBe(0.5);
		expect(monthProgress('2026-12-01', '2026-11')).toBe(1);
		expect(monthProgress('2026-10-31', '2026-11')).toBe(0);
	});
});
