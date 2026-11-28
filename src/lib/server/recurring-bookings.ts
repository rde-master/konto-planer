// The bookings of a recurring item (tab "Buchungen" on its page): real payments and the
// provisional ones, on the accounts the viewer can see.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookings } from './db/schema.js';
import { listAccountsFor } from './accounts.js';
import type { Viewer } from './account-rules.js';

export type ItemBooking = {
	id: string;
	bookingDate: string;
	/** Signed cents. */
	amount: number;
	source: string;
	counterparty: string | null;
	purpose: string | null;
	accountName: string;
};

export type ItemBookings = {
	/** Newest first, at most `limit`. */
	rows: ItemBooking[];
	/** All bookings of the item on visible accounts, and their sum. */
	count: number;
	sum: number;
};

export const ITEM_BOOKINGS_LIMIT = 200;

export async function itemBookings(
	viewer: Viewer,
	recurringId: string,
	limit = ITEM_BOOKINGS_LIMIT
): Promise<ItemBookings> {
	const accounts = await listAccountsFor(viewer);
	if (!accounts.length) return { rows: [], count: 0, sum: 0 };
	const names = new Map(accounts.map((a) => [a.id, a.name]));
	const where = and(
		eq(bookings.recurringId, recurringId),
		inArray(
			bookings.accountId,
			accounts.map((a) => a.id)
		)
	);
	const [rows, [total]] = await Promise.all([
		db
			.select({
				id: bookings.id,
				bookingDate: bookings.bookingDate,
				amount: bookings.amount,
				source: bookings.source,
				counterparty: bookings.counterparty,
				purpose: bookings.purpose,
				accountId: bookings.accountId
			})
			.from(bookings)
			.where(where)
			.orderBy(desc(bookings.bookingDate), desc(bookings.createdAt))
			.limit(limit),
		db
			.select({
				count: sql<number>`count(*)::int`,
				sum: sql<string | null>`sum(${bookings.amount})`
			})
			.from(bookings)
			.where(where)
	]);
	return {
		rows: rows.map(({ accountId, ...r }) => ({ ...r, accountName: names.get(accountId) ?? '' })),
		count: total?.count ?? 0,
		sum: Number(total?.sum ?? 0)
	};
}
