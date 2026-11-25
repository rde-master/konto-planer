import { describe, expect, it } from 'vitest';
import { monthLabel, validateTagName, yearSummary } from './tags';

describe('validateTagName', () => {
	it('trims, drops a leading # and limits the length', () => {
		expect(validateTagName('  #Urlaub   Italien ')).toEqual({
			name: 'Urlaub Italien',
			error: null
		});
		expect(validateTagName('#').error).toBe('Bitte einen Namen eingeben.');
		expect(validateTagName('x'.repeat(31)).error).toBe('Höchstens 30 Zeichen.');
	});
});

describe('yearSummary', () => {
	it('sums, groups by category (with splits) and by month', () => {
		const s = yearSummary([
			{ id: 'a', bookingDate: '2026-03-02', amount: -100_00, categoryId: 'hotel', parts: [] },
			{
				id: 'b',
				bookingDate: '2026-03-05',
				amount: -50_00,
				categoryId: 'food',
				parts: [{ amount: -20_00, categoryId: 'fuel' }]
			},
			{ id: 'c', bookingDate: '2026-04-01', amount: 30_00, categoryId: null, parts: [] }
		]);
		expect(s.income).toBe(30_00);
		expect(s.expenses).toBe(-150_00);
		expect(s.byCategory).toEqual([
			{ categoryId: 'hotel', amount: -100_00 },
			{ categoryId: 'food', amount: -30_00 },
			{ categoryId: null, amount: 30_00 },
			{ categoryId: 'fuel', amount: -20_00 }
		]);
		expect(s.months.map((m) => [m.month, m.total, m.bookings.map((b) => b.id)])).toEqual([
			['2026-04', 30_00, ['c']],
			['2026-03', -150_00, ['b', 'a']]
		]);
		expect(monthLabel('2026-03')).toBe('März 2026');
	});
});
