import { describe, expect, it } from 'vitest';
import { duesBetween, duesUntil, openPayments, reconcileDues, type ExistingDue } from './due';
import type { Schedule } from './recurring';

const monthly: Schedule = {
	interval: 'monthly',
	customEvery: null,
	customUnit: null,
	startDate: '2026-08-01',
	endDate: null
};
const amounts = [
	{ amount: 800_00, validFrom: '2026-08-01' },
	{ amount: 850_00, validFrom: '2026-11-01' }
];

describe('duesUntil', () => {
	it('shifts to bank days and takes the amount of the due date', () => {
		expect(duesUntil(monthly, amounts, '2026-08-01', '2026-11-24')).toEqual([
			{ dueDate: '2026-08-01', bookingDate: '2026-08-03', amount: 800_00 }, // Saturday
			{ dueDate: '2026-09-01', bookingDate: '2026-09-01', amount: 800_00 },
			{ dueDate: '2026-10-01', bookingDate: '2026-10-01', amount: 800_00 },
			{ dueDate: '2026-11-01', bookingDate: '2026-11-02', amount: 850_00 } // Sunday
		]);
	});
	it('a due date shifted beyond today is not booked yet', () => {
		expect(duesUntil(monthly, amounts, '2026-08-01', '2026-08-02')).toEqual([]);
	});
	it('starts at `from` (opening date)', () => {
		expect(duesUntil(monthly, amounts, '2026-10-15', '2026-11-24').map((d) => d.dueDate)).toEqual([
			'2026-11-01'
		]);
	});
});

describe('duesBetween', () => {
	it('includes due dates that shift into the range', () => {
		expect(duesBetween(monthly, amounts, '2026-11-02', '2026-12-31')).toEqual([
			{ dueDate: '2026-11-01', bookingDate: '2026-11-02', amount: 850_00 },
			{ dueDate: '2026-12-01', bookingDate: '2026-12-01', amount: 850_00 }
		]);
	});
});

const existing = (over: Partial<ExistingDue>): ExistingDue => ({
	id: 'x',
	dueDate: '2026-09-01',
	bookingDate: '2026-09-01',
	amount: 800_00,
	status: 'provisional',
	moved: false,
	amountSet: false,
	...over
});

describe('reconcileDues', () => {
	const expected = [
		{ dueDate: '2026-09-01', bookingDate: '2026-09-01', amount: 820_00 },
		{ dueDate: '2026-10-01', bookingDate: '2026-10-01', amount: 820_00 }
	];
	it('creates missing and updates untouched provisional items', () => {
		expect(reconcileDues(expected, [existing({ id: 'a' })])).toEqual({
			create: [expected[1]],
			update: [{ id: 'a', bookingDate: '2026-09-01', amount: 820_00 }],
			remove: []
		});
	});
	it('keeps hand-made date and amount', () => {
		const plan = reconcileDues(expected, [
			existing({ id: 'a', bookingDate: '2026-09-04', moved: true, amountSet: true }),
			existing({ id: 'b', dueDate: '2026-10-01', bookingDate: '2026-10-01', status: 'skipped' })
		]);
		expect(plan).toEqual({ create: [], update: [], remove: [] });
	});
	it('removes items the schedule no longer has, except confirmed ones', () => {
		const plan = reconcileDues(
			[],
			[
				existing({ id: 'a' }),
				existing({ id: 'b', dueDate: '2026-10-01', status: 'skipped' }),
				existing({ id: 'c', dueDate: '2026-11-01', status: 'booked' })
			]
		);
		expect(plan.remove).toEqual(['a', 'b']);
	});
});

describe('openPayments', () => {
	const rent = {
		...monthly,
		id: 'rent',
		name: 'Miete',
		kind: 'expense' as const,
		accountId: 'giro',
		targetAccountId: null,
		amounts
	};
	const saving = {
		...monthly,
		startDate: '2026-08-15',
		id: 'save',
		name: 'Sparen',
		kind: 'transfer' as const,
		accountId: 'giro',
		targetAccountId: 'spar',
		amounts: [{ amount: 100_00, validFrom: '2026-08-01' }]
	};
	it('lists both sides of a transfer, sorted by bank day', () => {
		const rows = openPayments(
			[rent, saving],
			new Set(['giro', 'spar']),
			'2026-11-25',
			'2026-12-31'
		);
		expect(rows.map((r) => [r.bookingDate, r.name, r.accountId, r.amount])).toEqual([
			['2026-12-01', 'Miete', 'giro', -850_00],
			['2026-12-15', 'Sparen', 'giro', -100_00],
			['2026-12-15', 'Sparen', 'spar', 100_00]
		]);
	});
	it('only shows visible accounts', () => {
		const rows = openPayments([rent, saving], new Set(['spar']), '2026-11-25', '2026-12-31');
		expect(rows.map((r) => r.accountId)).toEqual(['spar']);
	});
});
