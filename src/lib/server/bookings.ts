import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import {
	accounts,
	bookingParts,
	bookings,
	categories,
	counterpartyCategories,
	type Booking
} from './db/schema.js';
import { payeeKey } from '../import-match.js';
import type { Part } from '../splits.js';
import { formatEuro } from '../money.js';
import { audit, type Actor } from './audit.js';
import { diff } from './audit-rules.js';
import { canEditAccount, type AccessLevel, type Viewer } from './account-rules.js';
import { getAccountFor, listAccountsFor } from './accounts.js';
import { categoryInfo, listCategories } from './categories.js';
import { buildTree } from './category-rules.js';
import { categoryGroups } from './recurring-form.js';
import type { AdjustmentValues, BookingContext, BookingValues } from './booking-rules.js';
import { adjustmentAmount, countsToBalance } from '../balance.js';
import { syncInterest } from './interest.js';
import { todayBerlin } from '../dates.js';

export class BookingError extends Error {}

type Executor = Pick<typeof db, 'select'>;

export type PartSummary = {
	id: string;
	amount: number;
	categoryId: string | null;
	category: { name: string; color: string | null; parentName: string | null } | null;
};

export type BookingSummary = Booking & {
	account: { id: string; name: string; color: string; level: AccessLevel };
	category: { name: string; color: string | null; parentName: string | null } | null;
	canEdit: boolean;
	/** Manual entries and adjustments can be deleted by editors. */
	canDelete: boolean;
	/** Imported bookings: only the category can be changed. */
	canCategorize: boolean;
	/** Manual and imported bookings can be split into categories. */
	canSplit: boolean;
	/** Parts of a split booking (empty if not split). */
	parts: PartSummary[];
	/** False for bookings before the account's opening date. */
	counts: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only manual entries can be changed in full; imports and adjustments follow other rules. */
function editable(
	account: { level: AccessLevel; archivedAt: Date | null },
	booking: Pick<Booking, 'source'>
) {
	return canEditAccount(account.level, account.archivedAt !== null) && booking.source === 'manual';
}

/** Adjustments cannot be changed, but deleted (e.g. a mistyped correction). */
function deletable(
	account: { level: AccessLevel; archivedAt: Date | null },
	booking: Pick<Booking, 'source'>
) {
	return (
		canEditAccount(account.level, account.archivedAt !== null) &&
		(booking.source === 'manual' || booking.source === 'adjustment')
	);
}

/** Real money (manual or imported) may be split by editors. */
function splittable(
	account: { level: AccessLevel; archivedAt: Date | null },
	booking: Pick<Booking, 'source'>
) {
	return (
		canEditAccount(account.level, account.archivedAt !== null) &&
		(booking.source === 'manual' || booking.source === 'import')
	);
}

async function partsOf(executor: Executor, ids: string[]) {
	if (!ids.length) return [];
	return executor
		.select()
		.from(bookingParts)
		.where(inArray(bookingParts.bookingId, ids))
		.orderBy(asc(bookingParts.position));
}

/** The category of an imported booking may be changed by editors (the rest comes from the bank). */
function categorizable(
	account: { level: AccessLevel; archivedAt: Date | null },
	booking: Pick<Booking, 'source'>
) {
	return canEditAccount(account.level, account.archivedAt !== null) && booking.source === 'import';
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
	const parts = await partsOf(
		db,
		rows.slice(0, limit).map((b) => b.id)
	);
	return {
		bookings: rows.slice(0, limit).map((b) => {
			const account = byId.get(b.accountId)!;
			return {
				canSplit: splittable(account, b),
				parts: parts
					.filter((p) => p.bookingId === b.id)
					.map((p) => ({
						id: p.id,
						amount: p.amount,
						categoryId: p.categoryId,
						category: category(p.categoryId)
					})),
				...b,
				account: { id: account.id, name: account.name, color: account.color, level: account.level },
				category: category(b.categoryId),
				canEdit: editable(account, b),
				canDelete: deletable(account, b),
				canCategorize: categorizable(account, b),
				counts: countsToBalance(account.openingDate, b.bookingDate)
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
	const parts = await partsOf(db, [b.id]);
	return {
		...b,
		canSplit: splittable(account, b),
		parts: parts.map((p) => ({
			id: p.id,
			amount: p.amount,
			categoryId: p.categoryId,
			category: category(p.categoryId)
		})),
		account: { id: account.id, name: account.name, color: account.color, level: account.level },
		category: category(b.categoryId),
		canEdit: editable(account, b),
		canDelete: deletable(account, b),
		canCategorize: categorizable(account, b),
		counts: countsToBalance(account.openingDate, b.bookingDate)
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
	if (current.parts.length) {
		const covered = current.parts.reduce((sum, p) => sum + p.amount, 0);
		if (
			Math.sign(covered) !== Math.sign(values.amount) ||
			Math.abs(covered) > Math.abs(values.amount)
		)
			throw new BookingError(
				'Der Betrag passt nicht mehr zur Aufteilung. Bitte erst die Aufteilung ändern.'
			);
	}
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

/**
 * Sets the category of an imported booking; the payee keeps it for later imports
 * (`counterparty_categories`).
 */
export async function setBookingCategory(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	categoryId: string | null
) {
	const current = await getBookingFor(actor, id);
	if (!current) throw new BookingError('Buchung nicht gefunden.');
	if (!current.canCategorize)
		throw new BookingError('Die Kategorie dieser Buchung darfst du nicht ändern.');
	if (categoryId) {
		const [cat] = await db
			.select({ id: categories.id })
			.from(categories)
			.where(eq(categories.id, categoryId));
		if (!cat) throw new BookingError('Diese Kategorie gibt es nicht.');
	}
	if (categoryId === current.categoryId) return;
	const key = payeeKey({ counterpartyIban: current.iban, counterparty: current.counterparty });
	await db.transaction(async (tx) => {
		await tx.update(bookings).set({ categoryId, updatedAt: new Date() }).where(eq(bookings.id, id));
		if (key)
			await tx
				.insert(counterpartyCategories)
				.values({ key, categoryId })
				.onConflictDoUpdate({
					target: counterpartyCategories.key,
					set: { categoryId, updatedAt: new Date() }
				});
		const before = await auditFields(tx, valuesOf(current));
		const after = await auditFields(tx, { ...valuesOf(current), categoryId });
		const changes = diff(before, after);
		if (changes)
			await audit(tx, {
				actor,
				entityType: 'booking',
				action: 'update',
				entityId: id,
				entityLabel: label(valuesOf(current), after.category),
				...changes
			});
	});
}

/** Text of a split for the audit log: "Lebensmittel −12,50 €; Drogerie −7,00 €". */
async function splitText(executor: Executor, parts: Part[]): Promise<string | null> {
	if (!parts.length) return null;
	const category = await categoryInfo(executor);
	return parts
		.map((p) => `${category(p.categoryId)?.name ?? 'Ohne Kategorie'} ${formatEuro(p.amount)}`)
		.join('; ');
}

/** Replaces the parts of a booking (empty = no longer split). */
export async function setSplit(actor: NonNullable<Actor> & Viewer, id: string, parts: Part[]) {
	const current = await getBookingFor(actor, id);
	if (!current) throw new BookingError('Buchung nicht gefunden.');
	if (!current.canSplit) throw new BookingError('Diese Buchung darfst du nicht aufteilen.');
	await db.transaction(async (tx) => {
		await tx.delete(bookingParts).where(eq(bookingParts.bookingId, id));
		if (parts.length)
			await tx
				.insert(bookingParts)
				.values(parts.map((p, i) => ({ ...p, bookingId: id, position: i })));
		const changes = diff(
			{ split: await splitText(tx, current.parts) },
			{ split: await splitText(tx, parts) }
		);
		if (changes)
			await audit(tx, {
				actor,
				entityType: 'booking',
				action: 'update',
				entityId: id,
				entityLabel: label(valuesOf(current), current.category?.name ?? null),
				...changes
			});
	});
}

export async function deleteBooking(actor: NonNullable<Actor> & Viewer, id: string) {
	const current = await getBookingFor(actor, id);
	if (!current) throw new BookingError('Buchung nicht gefunden.');
	if (!current.canDelete) throw new BookingError('Du darfst diese Buchung nicht löschen.');
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
	// Deleting an adjustment on a savings account changes its interest.
	await syncInterest([current.accountId]);
}

/** Number of bookings on an account (shown on the account page). */
export async function countBookings(accountId: string): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(bookings)
		.where(and(eq(bookings.accountId, accountId)));
	return row?.n ?? 0;
}

/** Sum of the counting bookings of an account up to the end of `date` (without opening balance). */
async function bookingSum(
	executor: Executor,
	account: { id: string; openingDate: string },
	date: string
): Promise<number> {
	const [row] = await executor
		.select({ sum: sql<string | null>`sum(${bookings.amount})` })
		.from(bookings)
		.where(
			and(
				eq(bookings.accountId, account.id),
				gte(bookings.bookingDate, account.openingDate),
				lte(bookings.bookingDate, date)
			)
		);
	return Number(row?.sum ?? 0);
}

/** Current balance (end of today) of each given account: opening balance + counting bookings. */
export async function balancesOf(
	list: { id: string; openingBalance: number; openingDate: string }[]
): Promise<Map<string, number>> {
	if (!list.length) return new Map();
	const today = todayBerlin();
	const rows = await db
		.select({ accountId: bookings.accountId, sum: sql<string>`sum(${bookings.amount})` })
		.from(bookings)
		.innerJoin(accounts, eq(accounts.id, bookings.accountId))
		.where(
			and(
				inArray(
					bookings.accountId,
					list.map((a) => a.id)
				),
				sql`${bookings.bookingDate} >= ${accounts.openingDate}`,
				lte(bookings.bookingDate, today)
			)
		)
		.groupBy(bookings.accountId);
	const sums = new Map(rows.map((r) => [r.accountId, Number(r.sum)]));
	return new Map(list.map((a) => [a.id, a.openingBalance + (sums.get(a.id) ?? 0)]));
}

/** Balance of one account at the end of `date`. */
export async function balanceOf(
	account: { id: string; openingBalance: number; openingDate: string },
	date = todayBerlin()
): Promise<number> {
	return account.openingBalance + (await bookingSum(db, account, date));
}

/**
 * "Kontostand korrigieren": books the difference between the computed and the actual balance
 * at the end of `date` as an adjustment. Returns the adjustment in cents.
 */
export async function adjustBalance(
	actor: NonNullable<Actor> & Viewer,
	accountId: string,
	values: AdjustmentValues
): Promise<number> {
	const account = await getAccountFor(actor, accountId);
	if (!account || !canEditAccount(account.level, account.archivedAt !== null))
		throw new BookingError('Diesen Kontostand darfst du nicht korrigieren.');
	const amount = await db.transaction(async (tx) => {
		// Serialise corrections of the same account so two at once cannot both book the difference.
		await tx.execute(sql`select id from accounts where id = ${accountId} for update`);
		const before = account.openingBalance + (await bookingSum(tx, account, values.date));
		const amount = adjustmentAmount(before, values.actual);
		if (amount === 0) throw new BookingError('Der Kontostand stimmt bereits.');
		const [created] = await tx
			.insert(bookings)
			.values({
				accountId,
				bookingDate: values.date,
				amount,
				source: 'adjustment',
				purpose: 'Anpassung des Kontostands',
				createdBy: actor.id
			})
			.returning({ id: bookings.id });
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'adjust',
			entityId: created.id,
			entityLabel: account.name,
			after: {
				account: account.name,
				bookingDate: values.date,
				balanceBefore: before,
				balanceAfter: values.actual,
				amount
			}
		});
		return amount;
	});
	await syncInterest([accountId]);
	return amount;
}
