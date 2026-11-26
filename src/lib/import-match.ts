// Assigning imported rows (see docs/PLAN.md "Import", steps 2–6): duplicates, recurring items,
// manual bookings, transfers between accounts of the app and suggestions for new items.
import type { ImportRow } from './csv-import.js';
import { duesBetween, type ExpectedDue } from './due.js';
import { addDays, type AmountEntry, type Interval, type Schedule } from './recurring.js';
import { payeeCore, payeeLabel, samePayee } from './payee-name.js';

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
	/** Amount varies from payment to payment (no amount check when matching by name). */
	variable?: boolean;
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
	via: 'mandate' | 'iban' | 'name' | 'amount';
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

/**
 * Names match when one contains the other – ignoring case, spaces and what changes from
 * booking to booking (dates, receipt numbers; see `payeeCore()`).
 */
export function namesMatch(a: string | null, b: string | null): boolean {
	return samePayee(a, b);
}

/** Largest deviation from the planned amount for a match by name alone (30 %). */
export const NAME_AMOUNT_TOLERANCE = 0.3;

const words = (text: string | null) =>
	payeeCore(text)
		.split(/[^\p{L}\p{N}&]+/u)
		.filter(Boolean);

/** The words of `part` stand in `text`, whole and in this order ("Netflix" in "netflix.com 24.11."). */
function containsWords(text: string | null, part: string | null): boolean {
	const all = words(text);
	const wanted = words(part);
	if (!wanted.length || wanted.join('').length < 4) return false;
	return all.some((_, i) => wanted.every((w, n) => all[i + n] === w));
}

/**
 * The row names the item: its payee matches the row's (or stands in the purpose when the
 * bank gives no payee), or the item's own name stands there as whole words.
 */
export function rowNamesItem(
	item: { name: string; counterparty: string | null },
	row: { counterparty: string | null; purpose: string | null }
): boolean {
	if (row.counterparty)
		return (
			(item.counterparty !== null && samePayee(item.counterparty, row.counterparty)) ||
			containsWords(row.counterparty, item.name)
		);
	return containsWords(row.purpose, item.counterparty) || containsWords(row.purpose, item.name);
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
 * file), recurring items (mandate and creditor ID, then IBAN, then name with a due date
 * ±10 days, then amount and date ±3 days – without an IBAN ±10 days if only one item fits),
 * manual bookings (same amount ±3 days), transfers to own accounts.
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

	for (const [position, r] of ordered.entries()) {
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
		const amount = Math.abs(r.amount);
		/** Nearest open due date, preferring one with exactly the row's amount. */
		const dueFor = (item: MatchItem) => {
			const dues = near(item, 10);
			return dues.find((d) => d.amount === amount) ?? dues[0] ?? null;
		};
		/** Best first: exact amount, then name, then any due date nearby. */
		const best = <T extends { due: ExpectedDue | null; named: boolean }>(list: T[]) =>
			list.sort(
				(a, b) =>
					Number(b.due?.amount === amount) - Number(a.due?.amount === amount) ||
					Number(b.named) - Number(a.named) ||
					Number(b.due !== null) - Number(a.due !== null)
			)[0];

		if (!found && r.counterpartyIban) {
			// Same IBAN. The payee's name may have changed – then a due date nearby must confirm it.
			const byIban = best(
				candidates
					.filter(({ item }) => {
						if (item.kind === 'transfer') {
							const other =
								item.accountId === ctx.accountId ? item.targetAccountId : item.accountId;
							return own !== undefined && own.id === other;
						}
						return item.iban === r.counterpartyIban;
					})
					.map(({ item }) => ({
						item,
						due: dueFor(item),
						named:
							item.kind === 'transfer' ||
							!item.counterparty ||
							namesMatch(item.counterparty, r.counterparty)
					}))
					.filter((x) => x.named || x.due)
			);
			if (byIban) found = { item: byIban.item, via: 'iban', due: byIban.due };
		}
		if (!found) {
			// No IBAN to go by (card statements) or a new one: the name and a due date nearby.
			const byName = best(
				candidates
					.filter(({ item }) => item.kind !== 'transfer' && rowNamesItem(item, r))
					.map(({ item }) => ({ item, due: dueFor(item), named: true }))
					.filter(({ item, due }) => {
						if (due === null) return false;
						if (due.amount === amount) return true;
						// Another amount: not if a later row of the file pays exactly the planned one.
						const exactFollows = ordered
							.slice(position + 1)
							.some(
								(o) =>
									Math.sign(o.amount) === sign &&
									Math.abs(o.amount) === due.amount &&
									!seen.has(o.checksum) &&
									days(o.bookingDate, due.bookingDate) <= 10 &&
									rowNamesItem(item, o)
							);
						return (
							!exactFollows &&
							(item.variable || Math.abs(due.amount - amount) <= due.amount * NAME_AMOUNT_TOLERANCE)
						);
					})
			);
			if (byName) found = { item: byName.item, via: 'name', due: byName.due };
		}
		if (!found)
			for (const { item } of candidates) {
				const due = near(item, 3).find((d) => d.amount === amount);
				if (due) {
					found = { item, via: 'amount', due };
					break;
				}
			}
		if (!found && !r.counterpartyIban) {
			// Card statements: no IBAN, the name may be another every time and the booking day
			// lags behind. The exact amount within ±10 days counts if only one item fits.
			const fits = candidates
				.filter(({ item }) => item.kind !== 'transfer')
				.map(({ item }) => ({ item, due: near(item, 10).find((d) => d.amount === amount) }))
				.filter((x) => x.due !== undefined);
			if (fits.length === 1) found = { item: fits[0].item, via: 'amount', due: fits[0].due! };
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

/**
 * Key of a payee for suggestions, remembered categories and logos: IBAN, otherwise the lasting
 * part of the name (`payeeCore()`), so that "NETFLIX.COM 24.11." and "NETFLIX.COM 24.12." are
 * the same payee.
 */
export function payeeKey(r: {
	counterpartyIban: string | null;
	counterparty: string | null;
}): string | null {
	if (r.counterpartyIban) return r.counterpartyIban;
	return payeeCore(r.counterparty) || null;
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
			// Without the date or receipt number of this one booking.
			name: payeeLabel(r.counterparty) || key,
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
