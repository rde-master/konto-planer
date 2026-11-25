import { describe, expect, it } from 'vitest';
import { applyChanges, describeChange, type Change, type WhatIfItem } from './whatif';
import { duesBetween } from './due';

const gym: WhatIfItem = {
	id: 'gym',
	name: 'Fitnessstudio',
	kind: 'expense',
	accountId: 'giro',
	targetAccountId: null,
	isSalary: false,
	interval: 'monthly',
	customEvery: null,
	customUnit: null,
	startDate: '2026-01-15',
	endDate: null,
	amounts: [{ amount: 30_00, validFrom: '2026-01-15' }]
};

const change = (over: Partial<Change>): Change => ({
	id: 'c',
	kind: 'cancel',
	recurringId: 'gym',
	name: null,
	direction: null,
	interval: null,
	amount: null,
	date: '2027-01-01',
	...over
});

describe('applyChanges', () => {
	it('cancel ends the item before the date; the original stays untouched', () => {
		const [after] = applyChanges([gym], [change({})], 'giro', (f) => f);
		expect(after.endDate).toBe('2026-12-31');
		expect(gym.endDate).toBeNull();
		expect(duesBetween(after, after.amounts, '2027-01-01', '2027-03-31')).toEqual([]);
	});

	it('a new amount applies from its date; a new item is added on the account', () => {
		const result = applyChanges(
			[gym],
			[
				change({ kind: 'amount', amount: 40_00, date: '2027-03-01' }),
				change({
					id: 'n',
					kind: 'add',
					recurringId: null,
					name: 'Netflix',
					direction: 'expense',
					interval: 'monthly',
					amount: 13_99,
					date: '2026-12-05'
				})
			],
			'giro',
			(f) => f
		);
		expect(result[0].amounts.at(-1)).toEqual({ amount: 40_00, validFrom: '2027-03-01' });
		expect(result[1]).toMatchObject({
			id: 'whatif-n',
			name: 'Netflix',
			kind: 'expense',
			accountId: 'giro',
			startDate: '2026-12-05'
		});
	});

	it('describes the changes', () => {
		const fmt = { day: (d: string) => d, euro: (c: number) => `${c / 100} €` };
		expect(describeChange(change({}), new Map([['gym', 'Fitnessstudio']]), fmt)).toBe(
			'Kündigen: Fitnessstudio ab 2027-01-01'
		);
	});
});
