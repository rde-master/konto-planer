import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checksumText, parseExport } from './csv-import';
import {
	analyzeRows,
	detectInterval,
	namesMatch,
	suggestItems,
	type ImportContext,
	type MatchItem
} from './import-match';

const OWN = 'giro';
const SAVINGS = 'spar';
const rows = parseExport(
	new Uint8Array(readFileSync('tests/fixtures/volksbank-beispiel.csv'))
).rows.map((r) => ({ ...r, checksum: checksumText(r) }));

function item(over: Partial<MatchItem>): MatchItem {
	return {
		id: 'x',
		name: 'x',
		kind: 'expense',
		accountId: OWN,
		targetAccountId: null,
		counterparty: null,
		iban: null,
		mandateReference: null,
		creditorId: null,
		categoryId: null,
		interval: 'monthly',
		customEvery: null,
		customUnit: null,
		startDate: '2026-10-01',
		endDate: null,
		amounts: [{ amount: 100, validFrom: '2026-01-01' }],
		...over
	};
}

const base: ImportContext = {
	accountId: OWN,
	known: new Set(),
	items: [],
	dues: [],
	replaceable: [],
	ownAccounts: [
		{ id: OWN, name: 'Giro', iban: 'DE09123456780001234567', archived: false },
		{ id: SAVINGS, name: 'Sparbuch', iban: 'DE25123456780007654321', archived: false }
	],
	counterCandidates: []
};

describe('analyzeRows', () => {
	it('assigns by mandate even if the amount changed, and flags the difference', () => {
		const strom = item({
			id: 'strom',
			name: 'Strom',
			startDate: '2026-10-02',
			mandateReference: 'mr-strom-0815',
			amounts: [{ amount: 60_00, validFrom: '2026-10-02' }]
		});
		const result = analyzeRows(rows, {
			...base,
			items: [strom],
			dues: [
				{
					id: 'd1',
					recurringId: 'strom',
					dueDate: '2026-11-02',
					status: 'provisional',
					sideBookingId: 'b1',
					sideProvisional: true
				}
			]
		});
		const nov = result.find((r) => r.bookingDate === '2026-11-03')!;
		expect(nov.status).toBe('recurring');
		expect(nov.recurring).toMatchObject({
			id: 'strom',
			via: 'mandate',
			amountDiffers: true,
			due: { dueDate: '2026-11-02', storedId: 'd1', replaceBookingId: 'b1' }
		});
		expect(result.find((r) => r.bookingDate === '2026-10-02')?.recurring?.due?.dueDate).toBe(
			'2026-10-02'
		);
	});

	it('assigns by IBAN and name, then by amount and date', () => {
		const miete = item({
			id: 'miete',
			iban: rows.find((r) => r.counterparty === 'Hausverwaltung Beispiel')!.counterpartyIban,
			counterparty: 'hausverwaltung',
			amounts: [{ amount: 850_00, validFrom: '2026-01-01' }]
		});
		const lohn = item({
			id: 'lohn',
			kind: 'income',
			startDate: '2026-10-01',
			amounts: [{ amount: 2_500_00, validFrom: '2026-01-01' }]
		});
		const result = analyzeRows(rows, { ...base, items: [miete, lohn] });
		expect(result.filter((r) => r.recurring?.id === 'miete').map((r) => r.recurring?.via)).toEqual([
			'iban',
			'iban'
		]);
		// 01.11.2026 is a Sunday: the due day moves to 02.11.
		expect(result.filter((r) => r.recurring?.id === 'lohn').map((r) => r.recurring?.via)).toEqual([
			'amount',
			'amount'
		]);
	});

	it('recognises transfers to own accounts and links an existing counter booking', () => {
		const result = analyzeRows(rows, {
			...base,
			counterCandidates: [{ id: 'c1', accountId: SAVINGS, date: '2026-10-05', amount: 200_00 }]
		});
		// File order is newest first: November, then October.
		const sparen = result.filter((r) => r.purpose?.startsWith('Sparen'));
		expect(sparen.map((r) => r.transfer)).toEqual([
			{ accountId: SAVINGS, accountName: 'Sparbuch', counterBookingId: null },
			{ accountId: SAVINGS, accountName: 'Sparbuch', counterBookingId: 'c1' }
		]);
	});

	it('a transfer item matches by the IBAN of the other account', () => {
		const sparen = item({
			id: 'sparen',
			kind: 'transfer',
			targetAccountId: SAVINGS,
			startDate: '2026-10-05',
			amounts: [{ amount: 200_00, validFrom: '2026-01-01' }]
		});
		const result = analyzeRows(rows, { ...base, items: [sparen] });
		expect(result.filter((r) => r.recurring?.id === 'sparen')).toHaveLength(2);
	});

	it('replaces manual bookings; duplicates stay duplicates', () => {
		const result = analyzeRows(rows, {
			...base,
			replaceable: [{ id: 'm1', date: '2026-11-13', amount: -12_80, kind: 'manual' }]
		});
		expect(result.filter((r) => r.status === 'replace').map((r) => r.replace?.id)).toEqual(['m1']);
		expect(result.filter((r) => r.status === 'duplicate')).toHaveLength(1);
	});
});

describe('suggestions', () => {
	it('detects intervals', () => {
		expect(detectInterval(['2026-10-01', '2026-11-02'])).toBe('monthly');
		expect(detectInterval(['2026-01-01', '2026-04-01', '2026-07-01'])).toBe('quarterly');
		expect(detectInterval(['2026-01-01', '2026-01-15'])).toBeNull();
		expect(namesMatch('Stadtwerke', 'STADTWERKE Musterstadt')).toBe(true);
		expect(namesMatch(null, 'x')).toBe(false);
	});

	it('suggests payees paid twice at a regular interval, not transfers or single payments', () => {
		const result = suggestItems(analyzeRows(rows, base), []);
		expect(result.map((s) => [s.name, s.kind, s.interval, s.amount])).toEqual([
			['Beispiel Maschinenbau GmbH', 'income', 'monthly', 2_500_00],
			['Hausverwaltung Beispiel', 'expense', 'monthly', 850_00],
			['Stadtwerke Musterstadt', 'expense', 'monthly', 64_00]
		]);
		expect(result[0].lastDate).toBe('2026-11-02');
	});

	it('uses earlier imports for payees seen once in the file', () => {
		const cafe = rows.find((r) => r.counterparty === 'Café Übersee')!;
		const result = suggestItems(analyzeRows(rows, base), [
			{
				date: '2026-10-12',
				amount: -12_80,
				counterparty: cafe.counterparty,
				counterpartyIban: cafe.counterpartyIban
			}
		]);
		expect(result.map((s) => s.name)).toContain('Café Übersee');
	});
});
