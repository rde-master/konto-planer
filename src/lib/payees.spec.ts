import { describe, expect, it } from 'vitest';
import {
	matchesPayee,
	parsePeriod,
	payeeTotals,
	periodPresets,
	splitSelection,
	type PayeeBooking
} from './payees';

const b = (date: string, amount: number, name: string | null, internal = false): PayeeBooking => ({
	date,
	amount,
	name,
	internal
});

const BOOKINGS = [
	b('2026-01-05', -40_00, 'Stadtwerke Musterstadt GmbH'),
	b('2026-02-05', -42_00, 'Stadtwerke Musterstadt GmbH'),
	b('2026-03-05', -42_00, 'SWM Energie'),
	b('2026-03-20', 12_00, 'SWM Energie'),
	b('2026-01-10', -9_99, 'FILMDIENST 10.01. BERLIN'),
	b('2026-02-10', -9_99, 'Filmdienst 10.02. Berlin'),
	b('2026-02-10', -9_99, 'Filmdienst 11.02. Berlin'),
	b('2026-02-12', -500_00, 'Erika Muster', true),
	b('2026-02-15', -3_50, null),
	b('2026-02-20', 2_000_00, 'Arbeitgeber AG')
];

describe('payeeTotals', () => {
	it('sums what was paid per payee, largest first, and leaves transfers and income out', () => {
		const totals = payeeTotals(BOOKINGS, []);
		expect(totals.map((t) => [t.label, t.paid, t.count])).toEqual([
			['Stadtwerke Musterstadt GmbH', 82_00, 2],
			['SWM Energie', 42_00, 1],
			['Filmdienst Berlin', 29_97, 3],
			['Ohne Empfänger', 3_50, 1]
		]);
	});

	it('tells payees apart by the lasting part of the name, not by dates or case', () => {
		const film = payeeTotals(BOOKINGS, []).find((t) => t.id === 'p:filmdienst berlin')!;
		// The spelling seen most often names the row; the search text is in every spelling.
		expect(film).toMatchObject({ label: 'Filmdienst Berlin', last: '2026-02-10', groupId: null });
		expect(film.members[0].search.toLowerCase()).toBe('filmdienst');
	});

	it('lists refunds beside the payments', () => {
		const swm = payeeTotals(BOOKINGS, []).find((t) => t.label === 'SWM Energie')!;
		expect(swm).toMatchObject({ paid: 42_00, received: 12_00, count: 1, last: '2026-03-05' });
	});

	it('counts names put together as one payee', () => {
		const totals = payeeTotals(BOOKINGS, [
			{ id: 'g1', name: 'Stadtwerke', keys: ['swm energie', 'stadtwerke musterstadt gmbh'] }
		]);
		expect(totals[0]).toMatchObject({
			id: 'g:g1',
			groupId: 'g1',
			label: 'Stadtwerke',
			paid: 124_00,
			received: 12_00,
			count: 3,
			last: '2026-03-05'
		});
		expect(totals[0].members.map((m) => [m.label, m.paid])).toEqual([
			['Stadtwerke Musterstadt GmbH', 82_00],
			['SWM Energie', 42_00]
		]);
		expect(totals.map((t) => t.label)).toEqual([
			'Stadtwerke',
			'Filmdienst Berlin',
			'Ohne Empfänger'
		]);
	});

	it('shows a group only with payments in the period, with the names that have some', () => {
		const groups = [
			{ id: 'g1', name: 'Stadtwerke', keys: ['swm energie', 'stadtwerke alt'] },
			{ id: 'g2', name: 'Leer', keys: ['niemand'] }
		];
		const totals = payeeTotals(BOOKINGS, groups);
		expect(totals.find((t) => t.groupId === 'g1')!.members.map((m) => m.key)).toEqual([
			'swm energie'
		]);
		expect(totals.some((t) => t.groupId === 'g2')).toBe(false);
	});

	it('does not list a payee that only paid in', () => {
		expect(payeeTotals(BOOKINGS, []).some((t) => t.label === 'Arbeitgeber AG')).toBe(false);
	});
});

describe('matchesPayee', () => {
	const [group] = payeeTotals(BOOKINGS, [
		{ id: 'g1', name: 'Stadtwerke', keys: ['swm energie', 'stadtwerke musterstadt gmbh'] }
	]);

	it('searches the row and the names behind it', () => {
		expect(matchesPayee(group, '')).toBe(true);
		expect(matchesPayee(group, ' stadtW ')).toBe(true);
		expect(matchesPayee(group, 'energie')).toBe(true);
		expect(matchesPayee(group, 'film')).toBe(false);
	});
});

describe('periods', () => {
	const params = (q: string) => new URLSearchParams(q);

	it('offers the usual periods', () => {
		expect(periodPresets('2026-11-27')).toEqual([
			{ label: 'Dieser Monat', from: '2026-11-01', to: '2026-11-30' },
			{ label: 'Letzter Monat', from: '2026-10-01', to: '2026-10-31' },
			{ label: '12 Monate', from: '2025-12-01', to: '2026-11-30' },
			{ label: 'Dieses Jahr', from: '2026-01-01', to: '2026-12-31' },
			{ label: 'Letztes Jahr', from: '2025-01-01', to: '2025-12-31' }
		]);
		expect(periodPresets('2026-01-15')[1]).toMatchObject({ from: '2025-12-01', to: '2025-12-31' });
	});

	it('reads the period from the address, the running year without one', () => {
		expect(parsePeriod(params('von=2026-03-01&bis=2026-03-31'), '2026-11-27')).toEqual({
			from: '2026-03-01',
			to: '2026-03-31'
		});
		expect(parsePeriod(params(''), '2026-11-27')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
		expect(parsePeriod(params('von=2026-02-31&bis=2026-06-30'), '2026-11-27').from).toBe(
			'2026-01-01'
		);
		expect(parsePeriod(params('von=gestern&bis=2026-13-45'), '2026-11-27')).toEqual({
			from: '2026-01-01',
			to: '2026-12-31'
		});
		// Turned round by mistake.
		expect(parsePeriod(params('von=2026-05-31&bis=2026-05-01'), '2026-11-27')).toEqual({
			from: '2026-05-01',
			to: '2026-05-31'
		});
	});
});

describe('splitSelection', () => {
	it('separates names and groups; the row without a payee is none', () => {
		expect(splitSelection(['p:swm energie', 'g:abc', 'p:', 'p:swm energie', 'x'])).toEqual({
			keys: ['swm energie'],
			groupIds: ['abc']
		});
	});
});
