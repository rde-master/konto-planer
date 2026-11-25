import { describe, expect, it } from 'vitest';
import { bankDaysBefore, manualReminders, type ManualItem } from './manual-transfers';

function item(over: Partial<ManualItem> = {}): ManualItem {
	return {
		id: 'r1',
		name: 'Miete Garage',
		kind: 'expense',
		accountId: 'a1',
		targetAccountId: null,
		interval: 'monthly',
		customEvery: null,
		customUnit: null,
		startDate: '2026-11-30',
		endDate: null,
		amounts: [{ validFrom: '2026-11-30', amount: 8000 }],
		paymentMethod: 'manual',
		...over
	};
}

describe('bankDaysBefore', () => {
	it('skips weekends and TARGET holidays', () => {
		expect(bankDaysBefore('2026-11-30', 0)).toBe('2026-11-30');
		expect(bankDaysBefore('2026-11-30', 1)).toBe('2026-11-27');
		expect(bankDaysBefore('2026-12-28', 1)).toBe('2026-12-24');
		expect(bankDaysBefore('2026-12-28', 2)).toBe('2026-12-23');
	});
});

describe('manualReminders', () => {
	it('starts lead bank days before the bank day', () => {
		expect(manualReminders([item()], [], new Set(), '2026-11-26', 1)).toEqual([]);
		const [r] = manualReminders([item()], [], new Set(), '2026-11-27', 1);
		expect(r).toMatchObject({
			dueDate: '2026-11-30',
			bookingDate: '2026-11-30',
			amount: 8000,
			overdue: false
		});
		expect(manualReminders([item()], [], new Set(), '2026-11-27', 0)).toEqual([]);
	});

	it('stays until done, imported or skipped', () => {
		const today = '2026-12-02';
		expect(manualReminders([item()], [], new Set(), today, 1)[0].overdue).toBe(true);
		expect(manualReminders([item()], [], new Set(['r1:2026-11-30']), today, 1)).toEqual([]);
		const stored = (status: 'provisional' | 'booked' | 'skipped') => [
			{ recurringId: 'r1', dueDate: '2026-11-30', bookingDate: '2026-12-01', amount: 9000, status }
		];
		expect(manualReminders([item()], stored('booked'), new Set(), today, 1)).toEqual([]);
		expect(manualReminders([item()], stored('skipped'), new Set(), today, 1)).toEqual([]);
		// A moved date and an adjusted amount count.
		expect(manualReminders([item()], stored('provisional'), new Set(), today, 1)[0]).toMatchObject({
			bookingDate: '2026-12-01',
			amount: 9000
		});
	});

	it('only outgoing items paid by hand', () => {
		const today = '2026-11-30';
		expect(
			manualReminders([item({ paymentMethod: 'standing_order' })], [], new Set(), today, 1)
		).toEqual([]);
		expect(manualReminders([item({ kind: 'income' })], [], new Set(), today, 1)).toEqual([]);
		expect(
			manualReminders([item({ kind: 'transfer', targetAccountId: 'a2' })], [], new Set(), today, 1)
		).toHaveLength(1);
	});

	it('forgets transfers older than the lookback', () => {
		expect(manualReminders([item()], [], new Set(), '2027-01-15', 1).map((r) => r.dueDate)).toEqual(
			['2026-12-30']
		);
	});
});
