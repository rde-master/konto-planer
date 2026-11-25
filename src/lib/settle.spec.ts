import { describe, expect, it } from 'vitest';
import {
	debts,
	equalShares,
	formatPercent,
	netBalances,
	owedAmounts,
	parsePercent
} from './settle';

describe('shares', () => {
	it('equal shares sum to 100 %', () => {
		expect([...equalShares(['a', 'b', 'c']).values()]).toEqual([3334, 3333, 3333]);
		expect(parsePercent('33,33')).toBe(3333);
		expect(parsePercent('101')).toBeNull();
		expect(parsePercent('x')).toBeNull();
		expect(formatPercent(3333)).toBe('33,33 %');
	});

	it('owed amounts add up to the cent', () => {
		const owed = owedAmounts(100_00, equalShares(['a', 'b', 'c']));
		expect([...owed.values()].reduce((s, v) => s + v, 0)).toBe(100_00);
		expect(owed.get('a')).toBe(33_34);
		expect(
			owedAmounts(
				10_01,
				new Map([
					['a', 7000],
					['b', 3000]
				])
			)
		).toEqual(
			new Map([
				['a', 7_01],
				['b', 3_00]
			])
		);
	});
});

describe('balances and debts', () => {
	it('the payer gets back the others’ shares; settlements reduce it', () => {
		const expenses = [
			{ amount: 90_00, payerId: 'anna', shares: equalShares(['anna', 'ben', 'cleo']) },
			{ amount: 30_00, payerId: 'ben', shares: equalShares(['anna', 'ben']) }
		];
		const net = netBalances(expenses, []);
		expect(Object.fromEntries(net)).toEqual({ anna: 45_00, ben: -15_00, cleo: -30_00 });
		expect(debts(net)).toEqual([
			{ fromUserId: 'cleo', toUserId: 'anna', amount: 30_00 },
			{ fromUserId: 'ben', toUserId: 'anna', amount: 15_00 }
		]);
		const after = netBalances(expenses, [{ fromUserId: 'cleo', toUserId: 'anna', amount: 30_00 }]);
		expect(debts(after)).toEqual([{ fromUserId: 'ben', toUserId: 'anna', amount: 15_00 }]);
	});
});
