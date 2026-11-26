import { describe, expect, it } from 'vitest';
import { monthBounds, monthSummaries, monthsSince, type MonthSums } from './account-months';

const sums = (month: string, incoming: number, outgoing: number, transfersOut = 0): MonthSums => ({
	month,
	incoming,
	outgoing,
	transfersOut,
	transfersIn: 0,
	outCount: outgoing ? 3 : 0
});

describe('monthBounds', () => {
	it('knows the last day of the month', () => {
		expect(monthBounds('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
		expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
		expect(monthBounds('2028-02').to).toBe('2028-02-29');
		expect(monthBounds('2026-12').to).toBe('2026-12-31');
	});
});

describe('monthSummaries', () => {
	const rows = [sums('2026-11', 3_480_00, -2_345_67, -600_00), sums('2026-09', 100_00, 0)];

	it('lists the last months newest first and fills months without bookings', () => {
		const out = monthSummaries(rows, '2026-11-26', '2020-01-01', 4);
		expect(out.map((m) => m.month)).toEqual(['2026-11', '2026-10', '2026-09', '2026-08']);
		expect(out[0]).toMatchObject({
			label: 'November 2026',
			from: '2026-11-01',
			to: '2026-11-30',
			outgoing: -2_345_67,
			transfersOut: -600_00,
			net: 1_134_33,
			current: true
		});
		expect(out[1]).toMatchObject({ incoming: 0, outgoing: 0, net: 0, current: false });
		expect(out[2].net).toBe(100_00);
	});

	it('crosses the turn of the year', () => {
		const out = monthSummaries([], '2027-01-15', '2020-01-01', 3);
		expect(out.map((m) => m.label)).toEqual(['Januar 2027', 'Dezember 2026', 'November 2026']);
	});

	it('starts with the month the account was opened in', () => {
		const out = monthSummaries(rows, '2026-11-26', '2026-10-20');
		expect(out.map((m) => m.month)).toEqual(['2026-11', '2026-10']);
		expect(monthSummaries(rows, '2026-11-26', '2026-11-26')).toHaveLength(1);
	});

	it('shows twelve months by default', () => {
		expect(monthSummaries([], '2026-11-26', '2020-01-01')).toHaveLength(12);
	});
});

describe('monthsSince', () => {
	it('is the first day of the oldest month, or the opening date if later', () => {
		expect(monthsSince('2026-11-26', '2020-01-01')).toBe('2025-12-01');
		expect(monthsSince('2026-11-26', '2026-10-20')).toBe('2026-10-20');
		expect(monthsSince('2026-11-26', '2020-01-01', 1)).toBe('2026-11-01');
	});
});
