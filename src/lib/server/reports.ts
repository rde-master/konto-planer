import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookingParts, bookings, recurringItems } from './db/schema.js';
import type { Viewer } from './account-rules.js';
import { listAccountsFor } from './accounts.js';
import { listRecurringFor } from './recurring.js';
import { listCategories } from './categories.js';
import {
	averageIncrease,
	fixedCostsByMonth,
	inOutByMonth,
	monthRange,
	monthsBack,
	priceChanges,
	ratio,
	regularIncomeByMonth,
	savedByMonth,
	type FixedItem,
	type PriceChange,
	type ReportBooking
} from '../reports.js';

/** Account choice: "giro" (default, all giro accounts), "alle" or one account id. */
export async function reportAccounts(viewer: Viewer, choice: string | null) {
	const all = await listAccountsFor(viewer);
	const options = [
		{ value: 'giro', label: 'Alle Girokonten' },
		{ value: 'alle', label: 'Alle Konten' },
		...all.map((a) => ({ value: a.id, label: a.name }))
	];
	const value = options.some((o) => o.value === choice) ? choice! : 'giro';
	const ids =
		value === 'giro'
			? all.filter((a) => a.type === 'giro').map((a) => a.id)
			: value === 'alle'
				? all.map((a) => a.id)
				: [value];
	return { value, options, ids };
}

/** Bookings of the accounts in a period, with split parts and the "internal transfer" flag. */
export async function reportBookings(
	ids: string[],
	from: string,
	to: string
): Promise<ReportBooking[]> {
	if (!ids.length) return [];
	const rows = await db
		.select({ b: bookings, kind: recurringItems.kind })
		.from(bookings)
		.leftJoin(recurringItems, eq(recurringItems.id, bookings.recurringId))
		.where(
			and(
				inArray(bookings.accountId, ids),
				gte(bookings.bookingDate, from),
				lte(bookings.bookingDate, to)
			)
		);
	const parts = rows.length
		? await db
				.select()
				.from(bookingParts)
				.where(
					inArray(
						bookingParts.bookingId,
						rows.map((r) => r.b.id)
					)
				)
		: [];
	return rows.map(({ b, kind }) => ({
		id: b.id,
		bookingDate: b.bookingDate,
		amount: b.amount,
		categoryId: b.categoryId,
		parts: parts
			.filter((p) => p.bookingId === b.id)
			.map((p) => ({ amount: p.amount, categoryId: p.categoryId })),
		internal: b.source === 'goal' || b.counterBookingId !== null || kind === 'transfer',
		label: b.counterparty ?? b.purpose ?? 'Buchung'
	}));
}

/** Active recurring income and expenses of the accounts. */
export async function reportItems(viewer: Viewer, ids: string[]): Promise<FixedItem[]> {
	const set = new Set(ids);
	return (await listRecurringFor(viewer))
		.filter((i) => !i.archivedAt && i.kind !== 'transfer' && set.has(i.accountId))
		.map((i) => ({
			id: i.id,
			name: i.name,
			kind: i.kind,
			categoryId: i.categoryId,
			interval: i.interval,
			customEvery: i.customEvery,
			customUnit: i.customUnit,
			startDate: i.startDate,
			endDate: i.endDate,
			pauseFrom: i.pauseFrom,
			pauseUntil: i.pauseUntil,
			amounts: i.amounts
		}));
}

export async function reportCategories() {
	return (await listCategories()).map((c) => ({
		id: c.id,
		name: c.name,
		color: c.color,
		parentId: c.parentId
	}));
}

export type Metrics = {
	/** Fixed costs ÷ regular income this month (null without regular income). */
	fixedRatio: number | null;
	fixedCosts: number;
	regularIncome: number;
	/** Net moved to savings accounts ÷ income, last 12 months. */
	savingsRate: number | null;
	saved: number;
	income: number;
	/** Per month: savings rate (null without income). */
	months: { month: string; rate: number | null; saved: number; income: number }[];
	averageIncrease: number | null;
	increases: PriceChange[];
};

/** Household metrics over all accounts the viewer sees (giro: income and costs; savings: saved). */
export async function metricsFor(viewer: Viewer, today: string): Promise<Metrics> {
	const all = (await listAccountsFor(viewer)).filter((a) => !a.archivedAt);
	const giro = all.filter((a) => a.type === 'giro').map((a) => a.id);
	const savings = all.filter((a) => a.type === 'sparbuch').map((a) => a.id);
	const thisMonth = today.slice(0, 7);
	const months = monthsBack(thisMonth, 12);
	const from = `${months[0]}-01`;
	const to = monthRange(thisMonth).to;
	const [items, giroRows, savingsRows] = await Promise.all([
		reportItems(viewer, giro),
		reportBookings(giro, from, to),
		reportBookings(savings, from, to)
	]);
	const fixedCosts = fixedCostsByMonth(items, [thisMonth])[0].amount;
	const regularIncome = regularIncomeByMonth(items, [thisMonth])[0];
	const incomes = inOutByMonth(giroRows, months).map((m) => m.income);
	const saved = savedByMonth(savingsRows, months);
	const income = incomes.reduce((s, v) => s + v, 0);
	const savedTotal = saved.reduce((s, v) => s + v, 0);
	const increases = priceChanges(
		items.filter((i) => i.kind === 'expense'),
		today
	);
	return {
		fixedRatio: ratio(fixedCosts, regularIncome),
		fixedCosts,
		regularIncome,
		savingsRate: ratio(savedTotal, income),
		saved: savedTotal,
		income,
		months: months.map((month, i) => ({
			month,
			rate: ratio(saved[i], incomes[i]),
			saved: saved[i],
			income: incomes[i]
		})),
		averageIncrease: averageIncrease(increases),
		increases: increases.slice(0, 5)
	};
}
