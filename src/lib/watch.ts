// Price and subscription watch ("Preis- und Abo-Wächter"): higher amounts of expenses and new
// regular debits found by the import.
import {
	addDays,
	addMonths,
	amountOn,
	dueDates,
	monthlyEquivalent,
	type AmountEntry,
	type Schedule
} from './recurring.js';

/** Increases are reported from this many days back (and announced future ones). */
export const WATCH_DAYS = 60;

export type WatchedItem = Pick<Schedule, 'interval' | 'customEvery' | 'customUnit'> & {
	id: string;
	name: string;
	kind: 'expense' | 'income' | 'transfer';
	variable: boolean;
	amounts: AmountEntry[];
};

export type PriceIncrease = {
	recurringId: string;
	name: string;
	/** Day the new amount applies (or the due date of a higher debit). */
	from: string;
	before: number;
	after: number;
	/** Whole per cent. */
	percent: number;
	/** Extra cost per year. */
	perYear: number;
	/** "amount": new amount stored; "paid": a debit was higher than the item. */
	source: 'amount' | 'paid';
};

function increase(
	item: WatchedItem,
	from: string,
	before: number,
	after: number,
	source: PriceIncrease['source']
): PriceIncrease {
	return {
		recurringId: item.id,
		name: item.name,
		from,
		before,
		after,
		percent: Math.round(((after - before) / before) * 100),
		perYear: Math.round(monthlyEquivalent(after - before, item) * 12),
		source
	};
}

const watched = (i: WatchedItem) => i.kind === 'expense' && !i.variable;

/** Stored amounts that are higher than the one before, from `today - WATCH_DAYS` on. */
export function priceIncreases(items: WatchedItem[], today: string): PriceIncrease[] {
	const since = addDays(today, -WATCH_DAYS);
	const out: PriceIncrease[] = [];
	for (const item of items.filter(watched)) {
		const sorted = [...item.amounts].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
		for (let i = 1; i < sorted.length; i++) {
			const [prev, next] = [sorted[i - 1], sorted[i]];
			if (next.validFrom >= since && prev.amount > 0 && next.amount > prev.amount)
				out.push(increase(item, next.validFrom, prev.amount, next.amount, 'amount'));
		}
	}
	return out;
}

export type PaidDue = { recurringId: string; dueDate: string; /** Positive cents. */ paid: number };

/** Imported debits of recent due dates that were higher than the item's amount. */
export function paidMore(items: WatchedItem[], dues: PaidDue[], today: string): PriceIncrease[] {
	const since = addDays(today, -WATCH_DAYS);
	const byId = new Map(items.filter(watched).map((i) => [i.id, i]));
	const out: PriceIncrease[] = [];
	for (const d of dues) {
		const item = byId.get(d.recurringId);
		if (!item || d.dueDate < since) continue;
		const planned = amountOn(item.amounts, d.dueDate);
		if (planned && d.paid > planned) out.push(increase(item, d.dueDate, planned, d.paid, 'paid'));
	}
	return out;
}

/** First due date after today of a regular payment last paid on `lastDate`. */
export function nextAfter(
	s: Pick<Schedule, 'interval' | 'customEvery' | 'customUnit'>,
	lastDate: string,
	today: string
): string | null {
	return (
		dueDates(
			{ ...s, startDate: lastDate, endDate: null },
			addDays(today, 1),
			addMonths(today, 13),
			1
		)[0] ?? null
	);
}
