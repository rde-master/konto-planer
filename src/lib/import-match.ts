// Assigning imported rows (see docs/PLAN.md "Import", steps 2–6): duplicates, recurring items,
// manual bookings, transfers between accounts of the app and suggestions for new items.
import type { ImportRow } from './csv-import.js';
import { duesBetween, type ExpectedDue } from './due.js';
import { addDays, type AmountEntry, type Interval, type Schedule } from './recurring.js';

export type MatchItem = Schedule & {
	id: string;
	name: string;
	kind: 'expense' | 'income' | 'transfer';
	accountId: string;
	targetAccountId: string | null;
	counterparty: string | null;
	iban: string | null;
	mandateReference: string | null;
	creditorId: string | null;
	categoryId: string | null;
	amounts: AmountEntry[];
};

/** Stored due item of a matchable item; `sideBookingId`: its booking on the imported account. */
export type StoredDue = {
	id: string;
	recurringId: string;
	dueDate: string;
	status: 'provisional' | 'skipped' | 'booked';
	sideBookingId: string | null;
	/** The side booking is still provisional (it gets replaced). */
	sideProvisional: boolean;
};

export type OwnAccount = { id: string; name: string; iban: string | null; archived: boolean };

/** Manual bookings, and counter bookings created by an import of the other account. */
export type Replaceable = { id: string; date: string; amount: number; kind: 'manual' | 'counter' };

/** Unlinked bookings on other accounts that may be the other side of a transfer. */
export type CounterCandidate = { id: string; accountId: string; date: string; amount: number };

export type ImportContext = {
	accountId: string;
	known: Set<string>;
	items: MatchItem[];
	dues: StoredDue[];
	replaceable: Replaceable[];
	ownAccounts: OwnAccount[];
	counterCandidates: CounterCandidate[];
};

export type RecurringMatch = {
	id: string;
	name: string;
	via: 'mandate' | 'iban' | 'amount';
	/** Due item the row fulfils (null if none lies near). */
	due: (ExpectedDue & { storedId: string | null; replaceBookingId: string | null }) | null;
	/** Planned amount differs from the bank's (positive cents). */
	amountDiffers: boolean;
};

export type AnalyzedRow = ImportRow & {
	checksum: string;
	status: 'new' | 'duplicate' | 'recurring' | 'replace';
	recurring: RecurringMatch | null;
	/** Manual booking (or counter booking) replaced by this row. */
	replace: (Replaceable & { kind: Replaceable['kind'] }) | null;
	/** Transfer to or from another account of the app. */
	transfer: { accountId: string; accountName: string; counterBookingId: string | null } | null;
};

function days(a: string, b: string): number {
	return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

function norm(value: string | null): string {
	return (value ?? '').toLowerCase().replace(/\s+/g, '');
}

/** Names match when one contains the other (ignoring case and spaces). */
export function namesMatch(a: string | null, b: string | null): boolean {
	const x = norm(a);
	const y = norm(b);
	return x !== '' && y !== '' && (x.includes(y) || y.includes(x));
}

/** Effect of an item on the account: -1 out, +1 in, 0 none. */
function sideOf(item: MatchItem, accountId: string): -1 | 0 | 1 {
	if (item.kind === 'transfer')
		return item.accountId === accountId ? -1 : item.targetAccountId === accountId ? 1 : 0;
	if (item.accountId !== accountId) return 0;
	return item.kind === 'income' ? 1 : -1;
}

/**
 * Status and assignment of every row. Order: duplicates (checksum stored or repeated in the
 * file), recurring items (mandate and creditor ID, then IBAN and name, then amount and date
 * ±3 days), manual bookings (same amount ±3 days), transfers to own accounts.
 */
export function analyzeRows(
	rows: (ImportRow & { checksum: string })[],
	ctx: ImportContext
): AnalyzedRow[] {
	const seen = new Set(ctx.known);
	const freeReplace = [...ctx.replaceable];
	const freeCounter = [...ctx.counterCandidates];
	const taken = new Set(
		ctx.dues.filter((d) => d.status === 'booked').map((d) => `${d.recurringId}|${d.dueDate}`)
	);
	const items = ctx.items
		.map((item) => ({ item, side: sideOf(item, ctx.accountId) }))
		.filter((x) => x.side !== 0);
	const ownByIban = new Map(
		ctx.ownAccounts.filter((a) => a.iban && a.id !== ctx.accountId).map((a) => [a.iban!, a])
	);
	const ordered = [...rows].sort(
		(a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.line - b.line
	);
	const out = new Map<number, AnalyzedRow>();

	for (const r of ordered) {
		const base = { ...r, recurring: null, replace: null, transfer: null };
		if (seen.has(r.checksum)) {
			out.set(r.line, { ...base, status: 'duplicate' });
			continue;
		}
		seen.add(r.checksum);
		const sign = r.amount < 0 ? -1 : 1;
		const own = r.counterpartyIban ? ownByIban.get(r.counterpartyIban) : undefined;
		const candidates = items.filter((x) => x.side === sign);

		const near = (item: MatchItem, tolerance: number) =>
			duesBetween(
				item,
				item.amounts,
				addDays(r.bookingDate, -tolerance),
				addDays(r.bookingDate, tolerance)
			)
				.filter((d) => !taken.has(`${item.id}|${d.dueDate}`))
				.sort((a, b) => days(a.bookingDate, r.bookingDate) - days(b.bookingDate, r.bookingDate));

		let found: { item: MatchItem; via: RecurringMatch['via']; due: ExpectedDue | null } | null =
			null;
		const byMandate = candidates.find(
			({ item }) =>
				item.mandateReference &&
				r.mandateReference &&
				norm(item.mandateReference) === norm(r.mandateReference) &&
				(!item.creditorId || !r.creditorId || norm(item.creditorId) === norm(r.creditorId))
		);
		if (byMandate)
			found = { item: byMandate.item, via: 'mandate', due: near(byMandate.item, 10)[0] ?? null };
		if (!found && r.counterpartyIban) {
			const byIban = candidates.find(({ item }) => {
				if (item.kind === 'transfer') {
					const other = item.accountId === ctx.accountId ? item.targetAccountId : item.accountId;
					return own !== undefined && own.id === other;
				}
				return (
					item.iban === r.counterpartyIban &&
					(!item.counterparty || namesMatch(item.counterparty, r.counterparty))
				);
			});
			if (byIban) found = { item: byIban.item, via: 'iban', due: near(byIban.item, 10)[0] ?? null };
		}
		if (!found)
			for (const { item } of candidates) {
				const due = near(item, 3).find((d) => d.amount === Math.abs(r.amount));
				if (due) {
					found = { item, via: 'amount', due };
					break;
				}
			}

		if (found) {
			const due = found.due;
			const stored = due
				? ctx.dues.find((d) => d.recurringId === found.item.id && d.dueDate === due.dueDate)
				: undefined;
			if (due) taken.add(`${found.item.id}|${due.dueDate}`);
			out.set(r.line, {
				...base,
				status: 'recurring',
				recurring: {
					id: found.item.id,
					name: found.item.name,
					via: found.via,
					due: due
						? {
								...due,
								storedId: stored?.id ?? null,
								replaceBookingId: stored?.sideProvisional ? stored.sideBookingId : null
							}
						: null,
					amountDiffers: due !== null && due.amount !== Math.abs(r.amount)
				},
				transfer: own ? { accountId: own.id, accountName: own.name, counterBookingId: null } : null
			});
			continue;
		}

		const replace = freeReplace
			.filter((c) => c.amount === r.amount && days(c.date, r.bookingDate) <= 3)
			.sort((a, b) => days(a.date, r.bookingDate) - days(b.date, r.bookingDate))[0];
		if (replace) {
			freeReplace.splice(freeReplace.indexOf(replace), 1);
			out.set(r.line, { ...base, status: 'replace', replace });
			continue;
		}

		let transfer: AnalyzedRow['transfer'] = null;
		if (own) {
			const counter = freeCounter
				.filter(
					(c) =>
						c.accountId === own.id && c.amount === -r.amount && days(c.date, r.bookingDate) <= 3
				)
				.sort((a, b) => days(a.date, r.bookingDate) - days(b.date, r.bookingDate))[0];
			if (counter) freeCounter.splice(freeCounter.indexOf(counter), 1);
			transfer = {
				accountId: own.id,
				accountName: own.name,
				counterBookingId: counter?.id ?? null
			};
		}
		out.set(r.line, { ...base, status: 'new', transfer });
	}
	return rows.map((r) => out.get(r.line)!);
}

/** Key of a payee for suggestions and remembered categories: IBAN, otherwise the name. */
export function payeeKey(r: {
	counterpartyIban: string | null;
	counterparty: string | null;
}): string | null {
	if (r.counterpartyIban) return r.counterpartyIban;
	const name = (r.counterparty ?? '').trim().toLowerCase();
	return name || null;
}

/** Interval from the median gap between payments (null if irregular). */
export function detectInterval(dates: string[]): Exclude<Interval, 'custom' | 'once'> | null {
	const sorted = [...new Set(dates)].sort();
	if (sorted.length < 2) return null;
	const gaps = sorted
		.slice(1)
		.map((d, i) => days(sorted[i], d))
		.sort((a, b) => a - b);
	const median = gaps[Math.floor(gaps.length / 2)];
	if (median >= 5 && median <= 9) return 'weekly';
	if (median >= 25 && median <= 35) return 'monthly';
	if (median >= 80 && median <= 100) return 'quarterly';
	if (median >= 170 && median <= 200) return 'semiannual';
	if (median >= 350 && median <= 380) return 'yearly';
	return null;
}

export type Suggestion = {
	key: string;
	name: string;
	iban: string | null;
	kind: 'expense' | 'income';
	interval: Exclude<Interval, 'custom' | 'once'>;
	/** Latest amount (positive cents) and day. */
	amount: number;
	lastDate: string;
	count: number;
	/** Lines of the file that belong to it. */
	lines: number[];
};

/**
 * New recurring items: payees without an item that were paid at least `min` times (rows of the
 * file plus earlier imports) at a regular interval, all in the same direction.
 */
export function suggestItems(
	rows: AnalyzedRow[],
	history: {
		date: string;
		amount: number;
		counterparty: string | null;
		counterpartyIban: string | null;
	}[],
	min = 2
): Suggestion[] {
	const groups = new Map<
		string,
		{
			name: string;
			iban: string | null;
			entries: { date: string; amount: number; line?: number }[];
		}
	>();
	const add = (
		r: { counterparty: string | null; counterpartyIban: string | null },
		entry: { date: string; amount: number; line?: number }
	) => {
		const key = payeeKey(r);
		if (!key) return;
		const g = groups.get(key) ?? {
			name: r.counterparty ?? key,
			iban: r.counterpartyIban,
			entries: []
		};
		g.entries.push(entry);
		groups.set(key, g);
	};
	for (const r of rows)
		if (r.status === 'new' && !r.transfer)
			add(r, { date: r.bookingDate, amount: r.amount, line: r.line });
	for (const h of history) {
		const key = payeeKey(h);
		if (key && groups.has(key)) add(h, { date: h.date, amount: h.amount });
	}
	const out: Suggestion[] = [];
	for (const [key, g] of groups) {
		const dates = [...new Set(g.entries.map((e) => e.date))];
		if (dates.length < min) continue;
		const signs = new Set(g.entries.map((e) => Math.sign(e.amount)));
		if (signs.size !== 1) continue;
		const interval = detectInterval(dates);
		if (!interval) continue;
		const latest = [...g.entries].sort((a, b) => b.date.localeCompare(a.date))[0];
		out.push({
			key,
			name: g.name,
			iban: g.iban,
			kind: latest.amount > 0 ? 'income' : 'expense',
			interval,
			amount: Math.abs(latest.amount),
			lastDate: latest.date,
			count: dates.length,
			lines: g.entries.filter((e) => e.line !== undefined).map((e) => e.line!)
		});
	}
	return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
