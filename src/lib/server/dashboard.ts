import { and, eq, gt, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { accounts as accountsTable, bookings } from './db/schema.js';
import type { AccountWithLevel } from './accounts.js';
import type { RecurringSummary } from './recurring.js';
import type { AccountPlan } from './minimum.js';
import { reportBookings, reportCategories } from './reports.js';
import { openPayments } from '../due.js';
import { forecast } from '../forecast.js';
import { expensesByCategory, inOutByMonth, monthsBack } from '../reports.js';
import { changePercent, donutSlices, historySeries, sparkPoints } from '../dashboard.js';
import { addDays, addMonths } from '../recurring.js';

/**
 * Chart data of the start page for the viewer's active accounts: net worth (6 months back, 30
 * days ahead), this month's expenses by category, income and expenses of six months, and a
 * balance line per giro account up to its cut-off day.
 */
export async function dashboardCharts(
	accounts: AccountWithLevel[],
	balances: Map<string, number>,
	plans: Map<string, AccountPlan>,
	items: RecurringSummary[],
	today: string
) {
	const ids = accounts.map((a) => a.id);
	if (!ids.length) return null;
	const from = addMonths(today, -6);
	const ahead = addDays(today, 30);
	const paying = accounts.filter((a) => a.type !== 'sparbuch').map((a) => a.id);
	const month = today.slice(0, 7);
	const months = monthsBack(month, 6);

	const [deltas, later, booked, categories] = await Promise.all([
		// Only bookings that count for the balance (from each account's opening date on).
		db
			.select({ date: bookings.bookingDate, amount: sql<string>`sum(${bookings.amount})` })
			.from(bookings)
			.innerJoin(accountsTable, eq(accountsTable.id, bookings.accountId))
			.where(
				and(
					inArray(bookings.accountId, ids),
					gt(bookings.bookingDate, from),
					lte(bookings.bookingDate, today),
					gte(bookings.bookingDate, accountsTable.openingDate)
				)
			)
			.groupBy(bookings.bookingDate),
		db
			.select({ date: bookings.bookingDate, amount: bookings.amount })
			.from(bookings)
			.where(
				and(
					inArray(bookings.accountId, ids),
					gt(bookings.bookingDate, today),
					lte(bookings.bookingDate, ahead)
				)
			),
		reportBookings(paying, `${months[0]}-01`, today),
		reportCategories()
	]);

	const total = accounts.reduce((s, a) => s + (balances.get(a.id) ?? a.openingBalance), 0);
	const history = historySeries(
		total,
		deltas.map((d) => ({ date: d.date, amount: Number(d.amount) })),
		from,
		today
	);
	// Transfers between own accounts appear on both sides and cancel out.
	const expected = [
		...openPayments(items, new Set(ids), addDays(today, 1), ahead).map((p) => ({
			date: p.bookingDate,
			amount: p.amount,
			label: p.name
		})),
		...later.map((b) => ({ date: b.date, amount: b.amount, label: 'Buchung' }))
	];
	const outlook = forecast(total, expected, today, ahead).series;

	const monthStart = `${month}-01`;
	const prevDay = addMonths(today, -1);
	const prevStart = `${prevDay.slice(0, 7)}-01`;
	const thisMonth = booked.filter((b) => b.bookingDate >= monthStart);
	const prevSame = booked.filter((b) => b.bookingDate >= prevStart && b.bookingDate <= prevDay);
	const byCategory = expensesByCategory(thisMonth, categories);
	const spent = byCategory.reduce((s, c) => s + c.amount, 0);
	const spentBefore = expensesByCategory(prevSame, categories).reduce((s, c) => s + c.amount, 0);

	const inOut = inOutByMonth(booked, months);

	return {
		netWorth: { history, outlook, change: total - history[0][1] },
		expenses: {
			month,
			total: spent,
			change: changePercent(spent, spentBefore),
			slices: donutSlices(
				byCategory.map((c) => ({ name: c.name, amount: c.amount, color: c.color }))
			)
		},
		inOut: {
			months,
			income: inOut.map((m) => m.income),
			expenses: inOut.map((m) => m.expenses)
		},
		sparks: Object.fromEntries(
			accounts
				.filter((a) => plans.has(a.id))
				.map((a) => {
					const plan = plans.get(a.id)!;
					return [
						a.id,
						sparkPoints(
							balances.get(a.id) ?? a.openingBalance,
							plan.plan.steps,
							today,
							plan.cutoff.date
						)
					];
				})
		)
	};
}
