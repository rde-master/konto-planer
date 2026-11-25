// Evaluations ("Auswertungen"): pure computations on bookings and recurring items.
import { categoryShares, type Part } from './splits.js';
import { duesBetween } from './due.js';
import {
	addDays,
	addMonths,
	amountOn,
	isPausedOn,
	monthlyEquivalent,
	type AmountEntry,
	type Schedule
} from './recurring.js';

export type ReportBooking = {
	id: string;
	bookingDate: string;
	amount: number;
	categoryId: string | null;
	parts: Part[];
	/** Transfer between own accounts (not income or expense). */
	internal: boolean;
	label: string;
};

export type CategoryNode = {
	id: string;
	name: string;
	color: string | null;
	parentId: string | null;
};

export type CategoryTotal = {
	id: string | null;
	name: string;
	color: string;
	/** Positive cents spent. */
	amount: number;
	children: { id: string; name: string; amount: number }[];
};

/** First and last day of a month ("2026-03"). */
export function monthRange(month: string): { from: string; to: string } {
	const from = `${month}-01`;
	return { from, to: addDays(addMonths(from, 1), -1) };
}

/** The `count` months ending with `last` ("2026-03"), oldest first. */
export function monthsBack(last: string, count: number): string[] {
	return Array.from({ length: count }, (_, i) =>
		addMonths(`${last}-01`, i - count + 1).slice(0, 7)
	);
}

/**
 * Expenses per main category (subcategories inside), largest first; split bookings by their
 * parts, refunds (positive amounts in a category) reduce it. Internal transfers are left out.
 */
export function expensesByCategory(
	bookings: ReportBooking[],
	categories: CategoryNode[]
): CategoryTotal[] {
	const byId = new Map(categories.map((c) => [c.id, c]));
	const totals = new Map<string | null, CategoryTotal>();
	for (const b of bookings) {
		if (b.internal) continue;
		for (const share of categoryShares(b, b.parts)) {
			const cat = share.categoryId ? byId.get(share.categoryId) : undefined;
			const main = cat?.parentId ? byId.get(cat.parentId) : cat;
			const key = main?.id ?? null;
			const t =
				totals.get(key) ??
				({
					id: key,
					name: main?.name ?? 'Ohne Kategorie',
					color: main?.color ?? 'gray',
					amount: 0,
					children: []
				} satisfies CategoryTotal);
			// Only expenses (and refunds in expense categories) count here.
			t.amount -= share.amount;
			if (cat && cat.parentId) {
				const child = t.children.find((c) => c.id === cat.id);
				if (child) child.amount -= share.amount;
				else t.children.push({ id: cat.id, name: cat.name, amount: -share.amount });
			}
			totals.set(key, t);
		}
	}
	return [...totals.values()]
		.filter((t) => t.amount > 0)
		.map((t) => ({
			...t,
			children: t.children.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount)
		}))
		.sort((a, b) => b.amount - a.amount);
}

export type MonthInOut = { month: string; income: number; expenses: number };

/** Income and expenses (positive cents) per month; internal transfers left out. */
export function inOutByMonth(bookings: ReportBooking[], months: string[]): MonthInOut[] {
	const out = new Map(months.map((m) => [m, { month: m, income: 0, expenses: 0 }]));
	for (const b of bookings) {
		if (b.internal) continue;
		const row = out.get(b.bookingDate.slice(0, 7));
		if (!row) continue;
		if (b.amount > 0) row.income += b.amount;
		else row.expenses -= b.amount;
	}
	return [...out.values()];
}

/** Share of income left after expenses (null without income). */
export function savingsRate(income: number, expenses: number): number | null {
	return income > 0 ? (income - expenses) / income : null;
}

export type FixedItem = Schedule & {
	id: string;
	name: string;
	kind: 'expense' | 'income' | 'transfer';
	categoryId: string | null;
	amounts: AmountEntry[];
};

/** Whether the item runs in the month (started, not ended, not paused the whole month). */
function runsIn(item: FixedItem, month: string): boolean {
	const { from, to } = monthRange(month);
	if (item.startDate > to) return false;
	if (item.endDate && item.endDate < from) return false;
	if (isPausedOn(item, from) && isPausedOn(item, to)) return false;
	return true;
}

/**
 * Fixed costs per month: recurring expenses converted to a monthly amount (yearly / 12 …),
 * with the amount valid at the end of the month. One-off payments do not count.
 */
export function fixedCostsByMonth(
	items: FixedItem[],
	months: string[]
): { month: string; amount: number; byCategory: Map<string | null, number> }[] {
	return months.map((month) => {
		const end = monthRange(month).to;
		const byCategory = new Map<string | null, number>();
		let amount = 0;
		for (const item of items) {
			if (item.kind !== 'expense' || item.interval === 'once' || !runsIn(item, month)) continue;
			const value = amountOn(item.amounts, end) ?? amountOn(item.amounts, item.startDate);
			if (!value) continue;
			const monthly = monthlyEquivalent(value, item);
			amount += monthly;
			byCategory.set(item.categoryId, (byCategory.get(item.categoryId) ?? 0) + monthly);
		}
		return { month, amount, byCategory };
	});
}

export type PriceChange = {
	id: string;
	name: string;
	first: { amount: number; validFrom: string };
	current: { amount: number; validFrom: string };
	/** Total change, e.g. 0.12 = +12 %. */
	change: number;
	/** Change per year (compound), null for less than a month between the two. */
	perYear: number | null;
};

/** Recurring items whose amount changed, with total and yearly change; largest yearly first. */
export function priceChanges(
	items: { id: string; name: string; amounts: AmountEntry[] }[],
	today: string
): PriceChange[] {
	const out: PriceChange[] = [];
	for (const item of items) {
		const past = [...item.amounts]
			.filter((a) => a.validFrom <= today)
			.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
		if (past.length < 2) continue;
		const first = past[0];
		const current = past.at(-1)!;
		if (first.amount === current.amount || first.amount <= 0) continue;
		const days =
			(Date.parse(`${current.validFrom}T00:00:00Z`) - Date.parse(`${first.validFrom}T00:00:00Z`)) /
			86_400_000;
		const ratio = current.amount / first.amount;
		out.push({
			id: item.id,
			name: item.name,
			first,
			current,
			change: ratio - 1,
			perYear: days >= 28 ? Math.pow(ratio, 365 / days) - 1 : null
		});
	}
	return out.sort((a, b) => (b.perYear ?? b.change) - (a.perYear ?? a.change));
}

export type CalendarMonth = {
	month: string;
	/** Positive cents of expense due dates in the month. */
	expenses: number;
	income: number;
	/** Largest expense payments of the month. */
	top: { id: string; name: string; amount: number; date: string }[];
};

/** Due payments of recurring items per month of a year ("Jahreskalender"). */
export function yearCalendar(items: FixedItem[], year: number): CalendarMonth[] {
	return Array.from({ length: 12 }, (_, i) => {
		const month = `${year}-${String(i + 1).padStart(2, '0')}`;
		const { from, to } = monthRange(month);
		let expenses = 0;
		let income = 0;
		const payments: CalendarMonth['top'] = [];
		for (const item of items) {
			if (item.kind === 'transfer') continue;
			for (const due of duesBetween(item, item.amounts, from, to)) {
				if (item.kind === 'income') income += due.amount;
				else {
					expenses += due.amount;
					payments.push({
						id: item.id,
						name: item.name,
						amount: due.amount,
						date: due.bookingDate
					});
				}
			}
		}
		payments.sort((a, b) => b.amount - a.amount);
		return { month, expenses, income, top: payments.slice(0, 3) };
	});
}

export type HeatDay = {
	date: string;
	/** Positive cents spent (bookings until today, planned due payments after). */
	amount: number;
	planned: boolean;
	entries: { label: string; amount: number }[];
};

/**
 * Expenses per day of a month: bookings up to today, planned due payments of recurring
 * expenses after today. Internal transfers left out.
 */
export function dayHeat(
	month: string,
	bookings: ReportBooking[],
	items: FixedItem[],
	today: string
): HeatDay[] {
	const { from, to } = monthRange(month);
	const days = new Map<string, HeatDay>();
	for (let d = from; d <= to; d = addDays(d, 1))
		days.set(d, { date: d, amount: 0, planned: d > today, entries: [] });
	for (const b of bookings) {
		const day = days.get(b.bookingDate);
		if (!day || b.internal || b.amount >= 0 || b.bookingDate > today) continue;
		day.amount -= b.amount;
		day.entries.push({ label: b.label, amount: -b.amount });
	}
	const future = from > today ? from : addDays(today, 1);
	if (future <= to)
		for (const item of items) {
			if (item.kind !== 'expense') continue;
			for (const due of duesBetween(item, item.amounts, future, to)) {
				const day = days.get(due.bookingDate);
				if (!day) continue;
				day.amount += due.amount;
				day.entries.push({ label: item.name, amount: due.amount });
			}
		}
	return [...days.values()];
}

/** Heat level 0–4 of an amount relative to the month's largest day. */
export function heatLevel(amount: number, max: number): number {
	if (amount <= 0 || max <= 0) return 0;
	return Math.min(4, Math.max(1, Math.ceil((amount / max) * 4)));
}

export type ComparisonRow = {
	id: string | null;
	name: string;
	color: string;
	now: number;
	before: number;
	/** now − before (positive = spent more). */
	diff: number;
	/** Relative change, null without spending before. */
	ratio: number | null;
};

/** Expenses per main category of two periods side by side, largest first. */
export function compareCategories(now: CategoryTotal[], before: CategoryTotal[]): ComparisonRow[] {
	const rows = new Map<string | null, ComparisonRow>();
	const row = (t: CategoryTotal) =>
		rows.get(t.id) ?? {
			id: t.id,
			name: t.name,
			color: t.color,
			now: 0,
			before: 0,
			diff: 0,
			ratio: null
		};
	for (const t of now) rows.set(t.id, { ...row(t), now: t.amount });
	for (const t of before) rows.set(t.id, { ...row(t), before: t.amount });
	return [...rows.values()]
		.map((r) => ({
			...r,
			diff: r.now - r.before,
			ratio: r.before > 0 ? r.now / r.before - 1 : null
		}))
		.sort((a, b) => Math.max(b.now, b.before) - Math.max(a.now, a.before));
}

/**
 * Periods to compare: the running year up to today against the same span of the previous
 * year; a past year against the whole previous year.
 */
export function comparisonPeriods(year: number, today: string) {
	const current = Number(today.slice(0, 4));
	if (year >= current) {
		const lastYearDay = addMonths(today, -12);
		return {
			now: { from: `${current}-01-01`, to: today },
			before: { from: `${current - 1}-01-01`, to: lastYearDay },
			partial: true
		};
	}
	return {
		now: { from: `${year}-01-01`, to: `${year}-12-31` },
		before: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
		partial: false
	};
}
