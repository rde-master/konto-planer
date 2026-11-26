import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookings, recurringItems } from './db/schema.js';
import { monthSummaries, monthsSince, type MonthSummary } from '../account-months.js';
import { todayBerlin } from '../dates.js';

/**
 * Sums per month for the account page: everything that came in and went out up to today,
 * from the opening date on (earlier bookings do not count to the balance either). Transfers
 * between accounts of the app are part of the sums and shown separately – the same rule as
 * `reportBookings()`: goal transfers, linked counter bookings and transfer items.
 */
export async function accountMonths(
	account: { id: string; openingDate: string },
	today = todayBerlin(),
	count = 12
): Promise<MonthSummary[]> {
	const internal = sql`(${bookings.source} = 'goal' or ${bookings.counterBookingId} is not null or ${recurringItems.kind} = 'transfer')`;
	const month = sql<string>`to_char(${bookings.bookingDate}, 'YYYY-MM')`;
	const sum = (condition: ReturnType<typeof sql>) =>
		sql<string>`coalesce(sum(${bookings.amount}) filter (where ${condition}), 0)`;
	const rows = await db
		.select({
			month,
			incoming: sum(sql`${bookings.amount} > 0`),
			outgoing: sum(sql`${bookings.amount} < 0`),
			transfersOut: sum(sql`${bookings.amount} < 0 and ${internal}`),
			transfersIn: sum(sql`${bookings.amount} > 0 and ${internal}`),
			outCount: sql<number>`(count(*) filter (where ${bookings.amount} < 0))::int`
		})
		.from(bookings)
		.leftJoin(recurringItems, eq(recurringItems.id, bookings.recurringId))
		.where(
			and(
				eq(bookings.accountId, account.id),
				gte(bookings.bookingDate, monthsSince(today, account.openingDate, count)),
				lte(bookings.bookingDate, today)
			)
		)
		.groupBy(month);
	return monthSummaries(
		rows.map((r) => ({
			month: r.month,
			incoming: Number(r.incoming),
			outgoing: Number(r.outgoing),
			transfersOut: Number(r.transfersOut),
			transfersIn: Number(r.transfersIn),
			outCount: r.outCount
		})),
		today,
		account.openingDate,
		count
	);
}
