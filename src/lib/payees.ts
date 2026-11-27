// Payee report ("Auswertungen › Empfänger"): what was paid to whom in a period. Payees are told
// apart by the lasting part of their name (`payeeCore()`); names the user put together count
// as one payee.
import { payeeCore, payeeLabel, payeePrefix } from './payee-name.js';
import { addMonths } from './recurring.js';
import { monthEnd } from './minimum.js';

export type PayeeBooking = {
	date: string;
	/** Signed cents (negative = paid). */
	amount: number;
	/** Payee as the bank or the user wrote it; null without one. */
	name: string | null;
	/** Transfer between own accounts (never a payment). */
	internal: boolean;
};

/** Names counted as one payee; `keys` are `payeeCore()` forms. */
export type PayeeGroupInfo = { id: string; name: string; keys: string[] };

export type PayeeMember = {
	key: string;
	label: string;
	/** Positive cents paid, and received back (refunds). */
	paid: number;
	received: number;
	/** Number of payments. */
	count: number;
	/** Day of the latest payment. */
	last: string;
	/** Text the booking search finds these payments by: the start all spellings share. */
	search: string;
};

export type PayeeTotal = Omit<PayeeMember, 'key'> & {
	/** `g:<group id>` or `p:<key>`. */
	id: string;
	groupId: string | null;
	/** Names behind the row, largest first (one for a payee that is not put together). */
	members: PayeeMember[];
};

/** Label of bookings without a payee; they form one row that cannot be put together. */
export const NO_PAYEE_LABEL = 'Ohne Empfänger';

/** Id of a single payee's row. */
export const payeeId = (key: string) => `p:${key}`;
export const groupRowId = (groupId: string) => `g:${groupId}`;

/**
 * Sums per payee, largest first. Only payees that were paid something appear; what came back
 * from them (refunds) is listed beside it. Internal transfers are left out.
 */
export function payeeTotals(bookings: PayeeBooking[], groups: PayeeGroupInfo[]): PayeeTotal[] {
	type Entry = PayeeMember & { spellings: Map<string, { n: number; last: string }> };
	const byKey = new Map<string, Entry>();
	for (const b of bookings) {
		if (b.internal || b.amount === 0) continue;
		const key = payeeCore(b.name);
		const e: Entry = byKey.get(key) ?? {
			key,
			label: '',
			paid: 0,
			received: 0,
			count: 0,
			last: '',
			search: '',
			spellings: new Map()
		};
		if (b.amount < 0) {
			e.paid -= b.amount;
			e.count++;
			if (b.date > e.last) e.last = b.date;
		} else e.received += b.amount;
		// The shortest leading part is contained in every spelling of the name.
		const prefix = payeePrefix(b.name);
		if (!e.search || prefix.length < e.search.length) e.search = prefix;
		const spelling = payeeLabel(b.name);
		const s = e.spellings.get(spelling) ?? { n: 0, last: '' };
		e.spellings.set(spelling, { n: s.n + 1, last: b.date > s.last ? b.date : s.last });
		byKey.set(key, e);
	}
	const members = new Map<string, PayeeMember>();
	for (const [key, e] of byKey) {
		if (e.paid <= 0) continue;
		// The spelling seen most often, the latest among equals.
		const label =
			[...e.spellings].sort(
				(a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last)
			)[0]?.[0] ?? '';
		members.set(key, {
			key,
			label: key === '' ? NO_PAYEE_LABEL : label,
			paid: e.paid,
			received: e.received,
			count: e.count,
			last: e.last,
			search: e.search
		});
	}
	const bySize = (a: PayeeMember, b: PayeeMember) =>
		b.paid - a.paid || a.label.localeCompare(b.label, 'de');
	const out: PayeeTotal[] = [];
	const grouped = new Set<string>();
	for (const g of groups) {
		const own = g.keys
			.map((k) => members.get(k))
			.filter((m) => m !== undefined)
			.sort(bySize);
		for (const m of own) grouped.add(m.key);
		if (!own.length) continue;
		out.push({
			id: groupRowId(g.id),
			groupId: g.id,
			label: g.name,
			paid: own.reduce((s, m) => s + m.paid, 0),
			received: own.reduce((s, m) => s + m.received, 0),
			count: own.reduce((s, m) => s + m.count, 0),
			last: own
				.map((m) => m.last)
				.sort()
				.at(-1)!,
			search: '',
			members: own
		});
	}
	for (const m of members.values())
		if (!grouped.has(m.key)) {
			const { key, ...rest } = m;
			out.push({ ...rest, id: payeeId(key), groupId: null, members: [m] });
		}
	return out.sort(
		(a, b) => b.paid - a.paid || a.label.localeCompare(b.label, 'de') || a.id.localeCompare(b.id)
	);
}

/** The row or one of its names contains the text (case ignored). */
export function matchesPayee(total: PayeeTotal, text: string): boolean {
	const needle = text.trim().toLowerCase();
	if (!needle) return true;
	return (
		total.label.toLowerCase().includes(needle) ||
		total.members.some((m) => m.label.toLowerCase().includes(needle))
	);
}

export type Period = { from: string; to: string };

/** A real calendar day ("2026-02-31" is none). */
function isDay(s: string | null): s is string {
	if (s === null || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
	const d = new Date(`${s}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** Ready-made periods offered above the report. */
export function periodPresets(today: string): (Period & { label: string })[] {
	const month = `${today.slice(0, 7)}-01`;
	const lastMonth = addMonths(month, -1);
	const year = Number(today.slice(0, 4));
	return [
		{ label: 'Dieser Monat', from: month, to: monthEnd(month) },
		{ label: 'Letzter Monat', from: lastMonth, to: monthEnd(lastMonth) },
		{ label: '12 Monate', from: addMonths(month, -11), to: monthEnd(month) },
		{ label: 'Dieses Jahr', from: `${year}-01-01`, to: `${year}-12-31` },
		{ label: 'Letztes Jahr', from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }
	];
}

/**
 * Period from the URL (`von`, `bis`); without valid days the running year. A period turned
 * round is put right.
 */
export function parsePeriod(params: Pick<URLSearchParams, 'get'>, today: string): Period {
	const year = today.slice(0, 4);
	const from = params.get('von');
	const to = params.get('bis');
	const period = {
		from: isDay(from) ? from : `${year}-01-01`,
		to: isDay(to) ? to : `${year}-12-31`
	};
	return period.from <= period.to ? period : { from: period.to, to: period.from };
}

/** Ids chosen for "Zusammenfassen" → the names and groups behind them. */
export function splitSelection(ids: string[]): { keys: string[]; groupIds: string[] } {
	const keys = new Set<string>();
	const groupIds = new Set<string>();
	for (const id of ids) {
		if (id.startsWith('g:')) groupIds.add(id.slice(2));
		// The row without a payee is no payee to put together.
		else if (id.startsWith('p:') && id.length > 2) keys.add(id.slice(2));
	}
	return { keys: [...keys], groupIds: [...groupIds] };
}
