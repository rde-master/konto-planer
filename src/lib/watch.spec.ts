import { describe, expect, it } from 'vitest';
import { nextAfter, paidMore, priceIncreases, type WatchedItem } from './watch';

const item = (over: Partial<WatchedItem> = {}): WatchedItem => ({
	id: 'r1',
	name: 'Streaming',
	kind: 'expense',
	variable: false,
	interval: 'monthly',
	customEvery: null,
	customUnit: null,
	amounts: [
		{ validFrom: '2026-01-01', amount: 1299 },
		{ validFrom: '2026-11-01', amount: 1499 }
	],
	...over
});

describe('priceIncreases', () => {
	it('reports a recent or announced increase with per cent and per year', () => {
		expect(priceIncreases([item()], '2026-11-25')).toEqual([
			{
				recurringId: 'r1',
				name: 'Streaming',
				from: '2026-11-01',
				before: 1299,
				after: 1499,
				percent: 15,
				perYear: 2400,
				source: 'amount'
			}
		]);
		const announced = item({
			amounts: [
				{ validFrom: '2026-01-01', amount: 1299 },
				{ validFrom: '2027-02-01', amount: 1399 }
			]
		});
		expect(priceIncreases([announced], '2026-11-25')[0].from).toBe('2027-02-01');
	});
	it('ignores old increases, decreases, income and variable items', () => {
		expect(priceIncreases([item()], '2027-03-01')).toEqual([]);
		const cheaper = item({
			amounts: [
				{ validFrom: '2026-01-01', amount: 1499 },
				{ validFrom: '2026-11-01', amount: 1299 }
			]
		});
		expect(priceIncreases([cheaper], '2026-11-25')).toEqual([]);
		expect(priceIncreases([item({ kind: 'income' })], '2026-11-25')).toEqual([]);
		expect(priceIncreases([item({ variable: true })], '2026-11-25')).toEqual([]);
	});
});

describe('paidMore', () => {
	it('reports a higher imported debit', () => {
		const [r] = paidMore(
			[item()],
			[{ recurringId: 'r1', dueDate: '2026-11-15', paid: 1599 }],
			'2026-11-25'
		);
		expect(r).toMatchObject({ before: 1499, after: 1599, source: 'paid', percent: 7 });
		expect(
			paidMore([item()], [{ recurringId: 'r1', dueDate: '2026-11-15', paid: 1499 }], '2026-11-25')
		).toEqual([]);
	});
});

describe('nextAfter', () => {
	it('continues the rhythm after today', () => {
		const s = { interval: 'monthly' as const, customEvery: null, customUnit: null };
		expect(nextAfter(s, '2026-10-15', '2026-11-25')).toBe('2026-12-15');
		expect(nextAfter(s, '2026-11-25', '2026-11-25')).toBe('2026-12-25');
	});
});
