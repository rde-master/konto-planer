import { and, eq, inArray, isNull, lte, max, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookings, imports } from './db/schema.js';
import { balanceAsOf, isStale, type BalanceAsOf } from '../import-reminder.js';
import { berlinDay, todayBerlin } from '../dates.js';

/** Latest imported day and the day of the latest import per account (undone ones excluded). */
export async function importInfo(accountIds: string[]) {
	const out = new Map<string, { importDate: string | null; lastImportDay: string | null }>();
	if (!accountIds.length) return out;
	const rows = await db
		.select({
			accountId: imports.accountId,
			importDate: max(imports.periodTo),
			lastImportAt: max(imports.completedAt)
		})
		.from(imports)
		.where(
			and(
				inArray(imports.accountId, accountIds),
				eq(imports.status, 'done'),
				isNull(imports.undoneAt)
			)
		)
		.groupBy(imports.accountId);
	for (const r of rows)
		out.set(r.accountId, {
			importDate: r.importDate,
			lastImportDay: r.lastImportAt ? berlinDay(new Date(r.lastImportAt)) : null
		});
	return out;
}

/** "Stand vom" per account: latest import, adjustment or opening date, and whether it is old. */
export async function balanceDates(
	accounts: { id: string; openingDate: string }[],
	today = todayBerlin()
): Promise<Map<string, BalanceAsOf & { stale: boolean }>> {
	const ids = accounts.map((a) => a.id);
	const out = new Map<string, BalanceAsOf & { stale: boolean }>();
	if (!ids.length) return out;
	const [info, adjustments] = await Promise.all([
		importInfo(ids),
		db
			.select({ accountId: bookings.accountId, date: sql<string>`max(${bookings.bookingDate})` })
			.from(bookings)
			.where(
				and(
					inArray(bookings.accountId, ids),
					eq(bookings.source, 'adjustment'),
					lte(bookings.bookingDate, today)
				)
			)
			.groupBy(bookings.accountId)
	]);
	const adjusted = new Map(adjustments.map((a) => [a.accountId, a.date]));
	for (const a of accounts) {
		const asOf = balanceAsOf(
			info.get(a.id)?.importDate ?? null,
			adjusted.get(a.id) ?? null,
			a.openingDate
		);
		out.set(a.id, { ...asOf, stale: isStale(asOf.date, today) });
	}
	return out;
}
