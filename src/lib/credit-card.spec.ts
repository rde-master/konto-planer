import { describe, expect, it } from 'vitest';
import { dayIn, debitDateFor, pendingSettlements, statementDates } from './credit-card';

describe('dates', () => {
	it('clamps missing days to the end of the month', () => {
		expect(dayIn(2027, 2, 31)).toBe('2027-02-28');
		expect(dayIn(2026, 13, 5)).toBe('2027-01-05');
	});
	it('lists statement dates', () => {
		expect(statementDates(20, '2026-11-01', '2027-01-31')).toEqual([
			'2026-11-20',
			'2026-12-20',
			'2027-01-20'
		]);
		expect(statementDates(31, '2027-02-01', '2027-03-31')).toEqual(['2027-02-28', '2027-03-31']);
	});
	it('debits in the same or the next month, on a bank day', () => {
		// 2026-11-28 is a Saturday → Monday.
		expect(debitDateFor('2026-11-20', 28)).toBe('2026-11-30');
		expect(debitDateFor('2026-11-20', 5)).toBe('2026-12-07');
		// Christmas: 25/26 December are TARGET holidays.
		expect(debitDateFor('2026-12-20', 25)).toBe('2026-12-28');
	});
});

describe('pendingSettlements', () => {
	const card = { statementDay: 20, debitDay: 28, openingDate: '2026-10-01', openingBalance: 0 };

	it('settles the statement balance and carries it forward', () => {
		const events = [
			{ date: '2026-10-05', amount: -10_000 },
			{ date: '2026-10-25', amount: -3_000 },
			{ date: '2026-11-10', amount: -2_000 }
		];
		expect(pendingSettlements(card, events, new Set(), '2026-11-30')).toEqual([
			{ statementDate: '2026-10-20', debitDate: '2026-10-28', amount: 10_000 },
			{ statementDate: '2026-11-20', debitDate: '2026-11-30', amount: 5_000 }
		]);
	});

	it('skips stored settlements whose bookings are among the events', () => {
		const events = [
			{ date: '2026-10-05', amount: -10_000 },
			{ date: '2026-10-28', amount: 10_000 },
			{ date: '2026-11-10', amount: -2_000 }
		];
		expect(pendingSettlements(card, events, new Set(['2026-10-20']), '2026-11-30')).toEqual([
			{ statementDate: '2026-11-20', debitDate: '2026-11-30', amount: 2_000 }
		]);
	});

	it('a credit balance is not debited', () => {
		const events = [{ date: '2026-10-05', amount: 5_000 }];
		expect(pendingSettlements(card, events, new Set(), '2026-10-31')).toEqual([
			{ statementDate: '2026-10-20', debitDate: '2026-10-28', amount: 0 }
		]);
	});

	it('counts the opening balance', () => {
		expect(
			pendingSettlements({ ...card, openingBalance: -4_000 }, [], new Set(), '2026-10-31')
		).toEqual([{ statementDate: '2026-10-20', debitDate: '2026-10-28', amount: 4_000 }]);
	});
});
