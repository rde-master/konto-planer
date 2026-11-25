import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookingParts, bookings, recurringItems } from './db/schema.js';
import type { Viewer } from './account-rules.js';
import { listAccountsFor } from './accounts.js';
import { listRecurringFor } from './recurring.js';
import { listCategories } from './categories.js';
import type { FixedItem, ReportBooking } from '../reports.js';

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
