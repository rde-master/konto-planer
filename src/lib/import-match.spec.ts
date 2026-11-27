import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checksumText, parseExport } from './csv-import';
import {
	analyzeRows,
	detectInterval,
	namesMatch,
	paidBy,
	suggestItems,
	type ImportContext,
	type MatchItem,
	type PaidCandidate
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

/** A card statement row: no IBAN, the day of purchase in the name. */
function cardRow(line: number, bookingDate: string, counterparty: string | null, amount: number) {
	const r = {
		line,
		accountIban: '',
		bookingDate,
		valueDate: bookingDate,
		counterparty,
		counterpartyIban: null,
		bookingText: 'Kartenzahlung',
		purpose: null as string | null,
		amount,
		balanceAfter: null,
		note: null,
		bankCategory: null,
		creditorId: null,
		mandateReference: null
	};
	return { ...r, checksum: `${line}|${bookingDate}|${counterparty}|${amount}` };
}

describe('matching by name', () => {
	const streaming = item({
		id: 'stream',
		name: 'Streaming',
		counterparty: 'Filmdienst Beispiel',
		startDate: '2026-09-24',
		amounts: [{ amount: 13_99, validFrom: '2026-01-01' }]
	});
	const ctx = { ...base, items: [streaming] };

	it('recognises a card payment whose name carries the day of purchase', () => {
		const [nov, dec, other] = analyzeRows(
			[
				cardRow(2, '2026-11-26', 'FILMDIENST BEISPIEL 24.11.', -13_99),
				cardRow(3, '2026-12-28', 'FILMDIENST BEISPIEL 24.12.', -13_99),
				cardRow(4, '2026-11-25', 'Buchhandlung Muster 24.11.', -13_99 - 1)
			],
			ctx
		);
		expect(nov.recurring).toMatchObject({ id: 'stream', via: 'name', amountDiffers: false });
		expect(nov.recurring?.due?.dueDate).toBe('2026-11-24');
		expect(dec.recurring?.due?.dueDate).toBe('2026-12-24');
		expect(other.status).toBe('new');
	});

	it('accepts a price change, but no amount far from the plan', () => {
		const [raised] = analyzeRows([cardRow(2, '2026-11-25', 'Filmdienst Beispiel', -15_99)], ctx);
		expect(raised.recurring).toMatchObject({ id: 'stream', via: 'name', amountDiffers: true });
		const [purchase] = analyzeRows([cardRow(2, '2026-11-25', 'Filmdienst Beispiel', -59_00)], ctx);
		expect(purchase.status).toBe('new');
		// A varying amount is expected to differ.
		const [varying] = analyzeRows([cardRow(2, '2026-11-25', 'Filmdienst Beispiel', -59_00)], {
			...base,
			items: [{ ...streaming, variable: true }]
		});
		expect(varying.recurring?.id).toBe('stream');
	});

	it('needs a due date nearby', () => {
		const [early] = analyzeRows([cardRow(2, '2026-11-10', 'Filmdienst Beispiel', -13_99)], ctx);
		expect(early.status).toBe('new');
	});

	it('takes the payment with the exact amount when two name the item', () => {
		const result = analyzeRows(
			[
				cardRow(2, '2026-11-20', 'Filmdienst Beispiel Shop', -12_00),
				cardRow(3, '2026-11-25', 'Filmdienst Beispiel 24.11.', -13_99)
			],
			ctx
		);
		expect(result.map((r) => r.recurring?.id ?? r.status)).toEqual(['new', 'stream']);
	});

	it('knows the item by its own name as whole words, also in the purpose', () => {
		const gym = item({
			id: 'gym',
			name: 'Sportpark',
			startDate: '2026-10-01',
			amounts: [{ amount: 29_00, validFrom: '2026-01-01' }]
		});
		const rowsIn = [
			cardRow(2, '2026-11-02', 'SPORTPARK MUSTERSTADT 01.11.', -29_00),
			cardRow(3, '2026-12-02', null, -29_00),
			cardRow(4, '2027-01-04', 'Sportparkhaus City', -29_00 - 100)
		];
		rowsIn[1].purpose = 'Beitrag Sportpark 12/2026';
		const result = analyzeRows(rowsIn, { ...base, items: [gym] });
		expect(result.map((r) => r.recurring?.via ?? r.status)).toEqual(['name', 'name', 'new']);
	});

	it('follows a payee whose name changed while the IBAN stayed', () => {
		const power = item({
			id: 'strom',
			name: 'Strom',
			counterparty: 'Stadtwerke Musterstadt',
			iban: 'DE02120300000000202051',
			startDate: '2026-10-01',
			amounts: [{ amount: 60_00, validFrom: '2026-01-01' }]
		});
		const renamed = {
			...cardRow(2, '2026-11-02', 'Energie Beispiel AG', -64_00),
			counterpartyIban: 'DE02120300000000202051'
		};
		const [hit] = analyzeRows([renamed], { ...base, items: [power] });
		expect(hit.recurring).toMatchObject({ id: 'strom', via: 'iban', amountDiffers: true });
		// Without a due date nearby the other name is somebody else at the same bank account.
		const [miss] = analyzeRows([{ ...renamed, bookingDate: '2026-11-16' }], {
			...base,
			items: [power]
		});
		expect(miss.status).toBe('new');
	});

	it('without IBAN and with another name the exact amount counts within ten days, if unambiguous', () => {
		const late = cardRow(2, '2026-12-01', 'ZAHLUNGSDIENST*XY 30.11.', -13_99);
		const [hit] = analyzeRows([late], ctx);
		expect(hit.recurring).toMatchObject({ id: 'stream', via: 'amount' });
		expect(hit.recurring?.due?.dueDate).toBe('2026-11-24');
		// Two items with this amount: nobody can tell which one it is.
		const twin = { ...streaming, id: 'twin', name: 'Zeitung', counterparty: 'Verlag Beispiel' };
		const [open] = analyzeRows([late], { ...base, items: [streaming, twin] });
		expect(open.status).toBe('new');
		// With an IBAN the bank day is reliable: three days as before.
		const [giro] = analyzeRows([{ ...late, counterpartyIban: 'DE02120300000000202051' }], ctx);
		expect(giro.status).toBe('new');
	});

	it('suggests a card subscription although the name differs every month', () => {
		const analyzed = analyzeRows(
			[
				cardRow(2, '2026-10-26', 'MUSIKDIENST MUSTER 24.10.', -9_99),
				cardRow(3, '2026-11-26', 'MUSIKDIENST MUSTER 24.11.', -9_99)
			],
			base
		);
		expect(suggestItems(analyzed, [])).toMatchObject([
			{ key: 'musikdienst muster', name: 'MUSIKDIENST MUSTER', interval: 'monthly', count: 2 }
		]);
	});
});

describe('assigned by hand', () => {
	const streaming = item({
		id: 'stream',
		name: 'Streaming',
		counterparty: 'Filmdienst Beispiel',
		startDate: '2026-09-24',
		amounts: [{ amount: 13_99, validFrom: '2026-01-01' }]
	});
	const paper = item({
		id: 'paper',
		name: 'Zeitung',
		startDate: '2026-09-20',
		amounts: [{ amount: 30_00, validFrom: '2026-01-01' }]
	});
	const ctx = { ...base, items: [streaming, paper] };

	it('goes to the chosen item and its nearest open due date, whatever name and amount', () => {
		const row = { ...cardRow(2, '2026-12-10', 'ZAHLDIENST*77 08.12.', -21_50), assign: 'stream' };
		const [hit] = analyzeRows([row], ctx);
		expect(hit.recurring).toMatchObject({ id: 'stream', via: 'manual', amountDiffers: true });
		expect(hit.recurring?.due?.dueDate).toBe('2026-12-24');
		// Without a due date within 31 days the booking still belongs to the item.
		const [far] = analyzeRows([{ ...row, bookingDate: '2026-07-01' }], ctx);
		expect(far.recurring).toMatchObject({ id: 'stream', via: 'manual', due: null });
	});

	it('takes its due date before the automatic assignment', () => {
		const result = analyzeRows(
			[
				cardRow(2, '2026-11-23', 'Filmdienst Beispiel', -13_99),
				{ ...cardRow(3, '2026-11-25', 'Irgendwer', -13_99), assign: 'stream' }
			],
			ctx
		);
		expect(result[1].recurring?.due?.dueDate).toBe('2026-11-24');
		// The earlier row would have matched by name; its due date is taken now.
		expect(result[0].status).toBe('new');
	});

	it('"no recurring item" switches the automatic assignment off', () => {
		const auto = cardRow(2, '2026-11-25', 'Filmdienst Beispiel 24.11.', -13_99);
		expect(analyzeRows([auto], ctx)[0].status).toBe('recurring');
		expect(analyzeRows([{ ...auto, assign: null }], ctx)[0].status).toBe('new');
	});

	it('ignores an item of the other direction or of another account', () => {
		const income = { ...cardRow(2, '2026-11-25', 'Erstattung', 13_99), assign: 'stream' };
		expect(analyzeRows([income], ctx)[0].status).toBe('new');
		const unknown = { ...cardRow(2, '2026-11-25', 'Irgendwer', -5_00), assign: 'nobody' };
		expect(analyzeRows([unknown], ctx)[0].status).toBe('new');
	});

	it('a learned name is recognised at the next import', () => {
		const learned = { ...ctx, items: [streaming, { ...paper, aliases: ['kiosk am markt'] }] };
		const [dec] = analyzeRows([cardRow(2, '2026-12-22', 'KIOSK AM MARKT 21.12.', -32_00)], learned);
		expect(dec.recurring).toMatchObject({ id: 'paper', via: 'name', amountDiffers: true });
		// Not learned: no match.
		expect(
			analyzeRows([cardRow(2, '2026-12-22', 'KIOSK AM MARKT 21.12.', -32_00)], ctx)[0].status
		).toBe('new');
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

describe('paidBy', () => {
	const cloud = item({ id: 'cloud', name: 'APPLE.COM iCloud' });
	const side = { accountId: OWN, amount: -349, date: '2026-11-26' };
	const booking = (over: Partial<PaidCandidate>): PaidCandidate => ({
		id: 'b',
		accountId: OWN,
		date: '2026-11-26',
		amount: -349,
		counterparty: null,
		purpose: 'APPLE.COM/BILL IRL CORK EUR 3,49 Umsatz vom 24.11.2026 MC Hauptkarte',
		iban: null,
		mandateReference: null,
		...over
	});

	it('takes the booking with the planned amount within three days, whatever its name', () => {
		expect(paidBy(cloud, side, [booking({})])?.id).toBe('b');
		expect(paidBy(cloud, side, [booking({ date: '2026-11-29' })])?.id).toBe('b');
		expect(paidBy(cloud, side, [booking({ date: '2026-11-30' })])).toBeNull();
	});

	it('needs the same account, direction and amount', () => {
		expect(paidBy(cloud, side, [booking({ accountId: SAVINGS })])).toBeNull();
		expect(paidBy(cloud, side, [booking({ amount: 349 })])).toBeNull();
		expect(paidBy(cloud, side, [booking({ amount: -399 })])).toBeNull();
	});

	it('looks ten days around the due date when the booking names the item', () => {
		const netflix = item({ id: 'n', name: 'Netflix', iban: 'DE02120300000000202051' });
		const far = { date: '2026-11-18', purpose: null };
		expect(paidBy(netflix, side, [booking(far)])).toBeNull();
		expect(
			paidBy(netflix, side, [booking({ ...far, counterparty: 'NETFLIX.COM 18.11.' })])?.id
		).toBe('b');
		expect(paidBy(netflix, side, [booking({ ...far, iban: 'DE02120300000000202051' })])?.id).toBe(
			'b'
		);
		const byMandate = item({ id: 'm', name: 'Strom', mandateReference: 'MR-1' });
		expect(paidBy(byMandate, side, [booking({ ...far, mandateReference: 'mr-1' })])?.id).toBe('b');
		expect(
			paidBy(item({ id: 'a', name: 'Zeitung', aliases: ['kiosk zentral'] }), side, [
				booking({ ...far, counterparty: 'KIOSK ZENTRAL 4711' })
			])?.id
		).toBe('b');
	});

	it('accepts another amount only for an item with varying amounts that is named', () => {
		const named = booking({ amount: -512, counterparty: 'Stadtwerke Musterstadt', purpose: null });
		const strom = item({ id: 's', name: 'Strom', counterparty: 'Stadtwerke Musterstadt' });
		expect(paidBy(strom, side, [named])).toBeNull();
		expect(paidBy({ ...strom, variable: true }, side, [named])?.id).toBe('b');
		expect(paidBy({ ...cloud, variable: true }, side, [booking({ amount: -512 })])).toBeNull();
	});

	it('prefers the exact amount, then the named booking, then the nearest day', () => {
		const list = [
			booking({ id: 'late', date: '2026-11-28' }),
			booking({ id: 'near', date: '2026-11-27' }),
			booking({ id: 'named', date: '2026-11-29', counterparty: 'APPLE.COM iCloud', purpose: null })
		];
		expect(paidBy(cloud, side, list)?.id).toBe('named');
		expect(paidBy(cloud, side, list.slice(0, 2))?.id).toBe('near');
	});

	it('names a transfer by amount and day only', () => {
		const transfer = item({
			id: 't',
			name: 'Sparplan',
			kind: 'transfer',
			targetAccountId: SAVINGS
		});
		const far = booking({ date: '2026-11-18', counterparty: 'Sparplan', purpose: null });
		expect(paidBy(transfer, side, [far])).toBeNull();
		expect(paidBy(transfer, side, [booking({ counterparty: 'Sparplan' })])?.id).toBe('b');
	});
});
