// Due items ("Fälligkeiten"): every due date of a recurring item, shifted to the next bank day.
// On its bank day a due item counts as provisionally booked (see docs/PLAN.md "Vorläufig gebucht").
import { nextBankDay } from './bank-calendar.js';
import { addDays, amountOn, dueDates, type AmountEntry, type Schedule } from './recurring.js';

export const DUE_STATUSES = ['provisional', 'skipped', 'booked'] as const;
export type DueStatus = (typeof DUE_STATUSES)[number];

export const DUE_STATUS_LABELS: Record<DueStatus | 'open', string> = {
	open: 'offen',
	provisional: 'vorläufig gebucht',
	skipped: 'zurückgenommen',
	booked: 'gebucht'
};

export type ExpectedDue = {
	/** Date of the schedule (unique per item). */
	dueDate: string;
	/** Next bank day on or after the due date. */
	bookingDate: string;
	/** Positive cents. */
	amount: number;
};

/** Due dates whose bank day lies in [from, to], with bank day and amount. */
export function duesBetween(
	s: Schedule,
	amounts: AmountEntry[],
	from: string,
	to: string
): ExpectedDue[] {
	// A due date up to a week before `from` can shift into the range (Easter: four days).
	const out: ExpectedDue[] = [];
	for (const dueDate of dueDates(s, addDays(from, -7), to)) {
		if (dueDate < s.startDate) continue;
		const bookingDate = nextBankDay(dueDate);
		const amount = amountOn(amounts, dueDate);
		if (bookingDate < from || bookingDate > to || amount === null) continue;
		out.push({ dueDate, bookingDate, amount });
	}
	return out;
}

/** Due items that should be provisionally booked by `today`, beginning with `from`. */
export function duesUntil(
	s: Schedule,
	amounts: AmountEntry[],
	from: string,
	today: string
): ExpectedDue[] {
	return duesBetween(s, amounts, from, today).filter((d) => d.dueDate >= from);
}

export type ExistingDue = {
	id: string;
	dueDate: string;
	bookingDate: string;
	amount: number;
	status: DueStatus;
	/** Date set by hand ("Verschieben"). */
	moved: boolean;
	/** Amount set by hand ("Betrag anpassen"). */
	amountSet: boolean;
};

export type DuePlan = {
	create: ExpectedDue[];
	update: { id: string; bookingDate: string; amount: number }[];
	remove: string[];
};

/**
 * Brings the stored due items in line with the schedule. Untouched provisional items follow
 * date and amount changes; items the schedule no longer has (end, pause, new start) disappear
 * unless they were confirmed by a real booking. Hand-made changes are kept.
 */
export function reconcileDues(expected: ExpectedDue[], existing: ExistingDue[]): DuePlan {
	const byDate = new Map(existing.map((e) => [e.dueDate, e]));
	const wanted = new Set(expected.map((e) => e.dueDate));
	const plan: DuePlan = { create: [], update: [], remove: [] };
	for (const exp of expected) {
		const cur = byDate.get(exp.dueDate);
		if (!cur) {
			plan.create.push(exp);
			continue;
		}
		if (cur.status !== 'provisional') continue;
		const bookingDate = cur.moved ? cur.bookingDate : exp.bookingDate;
		const amount = cur.amountSet ? cur.amount : exp.amount;
		if (bookingDate !== cur.bookingDate || amount !== cur.amount)
			plan.update.push({ id: cur.id, bookingDate, amount });
	}
	for (const cur of existing)
		if (!wanted.has(cur.dueDate) && cur.status !== 'booked') plan.remove.push(cur.id);
	return plan;
}

export type PlannedItem = Schedule & {
	id: string;
	name: string;
	kind: 'expense' | 'income' | 'transfer';
	accountId: string;
	targetAccountId: string | null;
	amounts: AmountEntry[];
};

export type OpenPayment = {
	recurringId: string;
	name: string;
	accountId: string;
	dueDate: string;
	bookingDate: string;
	/** Effect on the account: negative = out. */
	amount: number;
};

/**
 * Upcoming payments ("Offene Zahlungen") on the given accounts with bank day in [from, to],
 * sorted by bank day; a transfer appears on each visible side.
 */
export function openPayments(
	items: PlannedItem[],
	accountIds: Set<string>,
	from: string,
	to: string
): OpenPayment[] {
	const out: OpenPayment[] = [];
	for (const item of items) {
		const sides: [string, number][] = [];
		if (accountIds.has(item.accountId))
			sides.push([item.accountId, item.kind === 'income' ? 1 : -1]);
		if (item.kind === 'transfer' && item.targetAccountId && accountIds.has(item.targetAccountId))
			sides.push([item.targetAccountId, 1]);
		if (!sides.length) continue;
		for (const due of duesBetween(item, item.amounts, from, to))
			for (const [accountId, sign] of sides)
				out.push({
					recurringId: item.id,
					name: item.name,
					accountId,
					dueDate: due.dueDate,
					bookingDate: due.bookingDate,
					amount: sign * due.amount
				});
	}
	return out.sort(
		(a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.name.localeCompare(b.name, 'de')
	);
}
