import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { accounts, bookings, categories, type Booking } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { diff } from './audit-rules.js';
import { canEditAccount, type AccessLevel, type Viewer } from './account-rules.js';
import { getAccountFor, listAccountsFor } from './accounts.js';
import { categoryInfo, listCategories } from './categories.js';
import { buildTree } from './category-rules.js';
import { categoryGroups } from './recurring-form.js';
import type { BookingContext, BookingValues } from './booking-rules.js';
import { todayBerlin } from '../dates.js';

export class BookingError extends Error {}

type Executor = Pick<typeof db, 'select'>;

export type BookingSummary = Booking & {
	account: { id: string; name: string; color: string; level: AccessLevel };
	category: { name: string; color: string | null; parentName: string | null } | null;
	canEdit: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only manual entries can be changed in full; imports and adjustments follow other rules. */
function editable(
	account: { level: AccessLevel; archivedAt: Date | null },
	booking: Pick<Booking, 'source'>
) {
	return canEditAccount(account.level, account.archivedAt !== null) && booking.source === 'manual';
}

/**
 * Select options and validation context for manual bookings: active giro accounts the viewer
 * may edit (savings accounts only receive transfers) and all categories.
 */
export async function bookingFormContext(viewer: Viewer) {
	const [visible, cats] = await Promise.all([listAccountsFor(viewer), listCategories()]);
	const bookingAccounts = visible
		.filter((a) => a.type === 'giro' && canEditAccount(a.level, a.archivedAt !== null))
		.map((a) => ({ value: a.id, label: a.name }));
	return {
		options: { bookingAccounts, categoryGroups: categoryGroups(buildTree(cats)) },
		ctx: {
			accountIds: new Set(bookingAccounts.map((a) => a.value)),
			categoryIds: new Set(cats.map((c) => c.id)),
			today: todayBerlin()
		} satisfies BookingContext
	};
}

/**
 * Bookings on accounts the viewer may see, newest first. `limit + 1` rows are read to know
 * whether there are more.
 */
export async function listBookingsFor(
	viewer: Viewer,
	{ accountId, limit }: { accountId?: string | null; limit: number }
): Promise<{ bookings: BookingSummary[]; more: boolean }> {
	const visible = await listAccountsFor(viewer);
	const ids = visible.map((a) => a.id).filter((id) => !accountId || id === accountId);
	if (!ids.length) return { bookings: [], more: false };
	const rows = await db
		.select()
		.from(bookings)
		.where(inArray(bookings.accountId, ids))
		.orderBy(desc(bookings.bookingDate), desc(bookings.createdAt))
		.limit(limit + 1);
	const byId = new Map(visible.map((a) => [a.id, a]));
	const category = await categoryInfo(db);
	return {
		bookings: rows.slice(0, limit).map((b) => {
			const account = byId.get(b.accountId)!;
			return {
				...b,
				account: { id: account.id, name: account.name, color: account.color, level: account.level },
				category: category(b.categoryId),
				canEdit: editable(account, b)
			};
		}),
		more: rows.length > limit
	};
}

/** The booking if the viewer may see its account, otherwise null (callers answer 404). */
export async function getBookingFor(viewer: Viewer, id: string): Promise<BookingSummary | null> {
	if (!UUID.test(id)) return null;
	const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
	if (!b) return null;
	const account = await getAccountFor(viewer, b.accountId);
	if (!account) return null;
	const category = await categoryInfo(db);
	return {
		...b,
		account: { id: account.id, name: account.name, color: account.color, level: account.level },
		category: category(b.categoryId),
		canEdit: editable(account, b)
	};
}

/** Audit fields: account and category by name. */
async function auditFields(executor: Executor, v: BookingValues) {
	const [account] = await executor
		.select({ name: accounts.name })
		.from(accounts)
		.where(eq(accounts.id, v.accountId));
	let category: string | null = null;
	if (v.categoryId) {
		const [c] = await executor
			.select({ name: categories.name })
			.from(categories)
			.where(eq(categories.id, v.categoryId));
		category = c?.name ?? null;
	}
	return {
		account: account?.name ?? null,
		bookingDate: v.bookingDate,
		amount: v.amount,
		category,
		counterparty: v.counterparty,
		purpose: v.purpose
	};
}

/** Short label for the log: payee, category or "Buchung", with the amount. */
function label(v: Pick<BookingValues, 'counterparty' | 'purpose'>, category: string | null) {
	return v.counterparty ?? v.purpose ?? category ?? 'Buchung';
}

function valuesOf(b: Booking): BookingValues {
	return {
		accountId: b.accountId,
		bookingDate: b.bookingDate,
		amount: b.amount,
		categoryId: b.categoryId,
		counterparty: b.counterparty,
		purpose: b.purpose
	};
}

/** Creates a manual booking; the values must be validated against `bookingFormContext`. */
export async function createBooking(
	actor: NonNullable<Actor> & Viewer,
	values: BookingValues
): Promise<string> {
	const account = await getAccountFor(actor, values.accountId);
	if (
		!account ||
		account.type !== 'giro' ||
		!canEditAccount(account.level, account.archivedAt !== null)
	)
		throw new BookingError('Auf diesem Konto darfst du nicht buchen.');
	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(bookings)
			.values({ ...values, source: 'manual', createdBy: actor.id })
			.returning({ id: bookings.id });
		const after = await auditFields(tx, values);
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'create',
			entityId: created.id,
			entityLabel: label(values, after.category),
			after
		});
		return created.id;
	});
}

async function requireEditable(viewer: Viewer, id: string) {
	const booking = await getBookingFor(viewer, id);
	if (!booking) throw new BookingError('Buchung nicht gefunden.');
	if (!booking.canEdit) throw new BookingError('Du darfst diese Buchung nicht bearbeiten.');
	return booking;
}

export async function updateBooking(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	values: BookingValues
) {
	const current = await requireEditable(actor, id);
	if (values.accountId !== current.accountId) {
		const account = await getAccountFor(actor, values.accountId);
		if (
			!account ||
			account.type !== 'giro' ||
			!canEditAccount(account.level, account.archivedAt !== null)
		)
			throw new BookingError('Auf diesem Konto darfst du nicht buchen.');
	}
	await db.transaction(async (tx) => {
		await tx
			.update(bookings)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(bookings.id, id));
		const after = await auditFields(tx, values);
		const changes = diff(await auditFields(tx, valuesOf(current)), after);
		if (changes)
			await audit(tx, {
				actor,
				entityType: 'booking',
				action: 'update',
				entityId: id,
				entityLabel: label(values, after.category),
				...changes
			});
	});
}

export async function deleteBooking(actor: NonNullable<Actor> & Viewer, id: string) {
	const current = await requireEditable(actor, id);
	await db.transaction(async (tx) => {
		const before = await auditFields(tx, valuesOf(current));
		await tx.delete(bookings).where(eq(bookings.id, id));
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'delete',
			entityId: id,
			entityLabel: label(current, before.category),
			before
		});
	});
}

/** Number of bookings on an account (shown on the account page). */
export async function countBookings(accountId: string): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(bookings)
		.where(and(eq(bookings.accountId, accountId)));
	return row?.n ?? 0;
}
