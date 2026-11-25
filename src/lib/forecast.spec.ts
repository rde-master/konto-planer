import { describe, expect, it } from 'vitest';
import { forecast } from './forecast';

const ev = (date: string, amount: number, first = false) => ({ date, amount, label: 'x', first });

describe('forecast', () => {
	it('one point per day, lowest point inside a day counted', () => {
		const f = forecast(
			1_000_00,
			[
				ev('2026-12-01', 2_000_00),
				ev('2026-12-01', -2_500_00),
				ev('2026-12-15', -300_00),
				ev('2026-11-20', -999_00),
				ev('2028-01-01', -1)
			],
			'2026-11-25',
			'2027-11-25'
		);
		expect(f.series).toEqual([
			['2026-11-25', 1_000_00],
			['2026-12-01', 500_00],
			['2026-12-15', 200_00],
			['2027-11-25', 200_00]
		]);
		// Before the salary the rent took the account to −1.500 €.
		expect(f.lowest).toEqual({ date: '2026-12-01', balance: -1_500_00 });
		expect(f.end).toBe(200_00);
	});

	it('without events the line stays flat', () => {
		expect(forecast(5, [], '2026-01-01', '2027-01-01')).toEqual({
			series: [
				['2026-01-01', 5],
				['2027-01-01', 5]
			],
			lowest: null,
			end: 5
		});
	});

	it('goal transfers count before the payment of their day', () => {
		const f = forecast(
			0,
			[ev('2026-02-01', -100_00), ev('2026-02-01', 100_00, true)],
			'2026-01-01',
			'2026-03-01'
		);
		expect(f.lowest).toEqual({ date: '2026-02-01', balance: 0 });
	});
});
