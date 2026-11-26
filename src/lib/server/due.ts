import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import {
	accounts,
	bookings,
	dueItems,
	recurringAmounts,
	recurringItems,
	type DueItem,
	type RecurringItem
} from './db/schema.js';
import { audit, type Actor } from './audit.js';
import type { Viewer } from './account-rules.js';
import { getRecurringFor } from './recurring.js';
import { duesUntil, reconcileDues, type ExpectedDue } from '../due.js';
import { todayBerlin } from '../dates.js';
import { isValidDate } from './recurring-rules.js';
import { syncInterest } from './interest.js';
import { syncSettlements } from './credit-cards.js';
import { syncGoals } from './goals.js';
import { purgeExpired } from './trash.js';
import { runNotifications } from './notify.js';
import { runMonthlyReports } from './monthly-report.js';

export class DueError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Signed amounts of a due item: on the paying account and (transfers) on the receiving one. */
function signed(item: Pick<RecurringItem, 'kind'>, amount: number) {
	return item.kind === 'income' ? amount : -amount;
}

/** Booking fields that follow the recurring item. */
function bookingFields(item: RecurringItem) {
	return {
		counterparty: item.counterparty,
		purpose: item.name,
		categoryId: item.kind === 'transfer' ? null : item.categoryId
	};
}

async function createBookings(
	tx: Tx,
	item: RecurringItem,
	due: { bookingDate: string; amount: number }
): Promise<{ bookingId: string; targetBookingId: string | null }> {
	const common = {
		...bookingFields(item),
		bookingDate: due.bookingDate,
		source: 'provisional' as const,
		recurringId: item.id
	};
	const [source] = await tx
		.insert(bookings)
		.values({ ...common, accountId: item.accountId, amount: signed(item, due.amount) })
		.returning({ id: bookings.id });
	let targetBookingId: string | null = null;
	if (item.kind === 'transfer' && item.targetAccountId) {
		const [target] = await tx
			.insert(bookings)
			.values({ ...common, accountId: item.targetAccountId, amount: due.amount })
			.returning({ id: bookings.id });
		targetBookingId = target.id;
	}
	return { bookingId: source.id, targetBookingId };
}

async function deleteBookingsOf(tx: Tx, rows: Pick<DueItem, 'bookingId' | 'targetBookingId'>[]) {
	const ids = rows.flatMap((r) => [r.bookingId, r.targetBookingId]).filter((id) => id !== null);
	if (ids.length)
		await tx
			.delete(bookings)
			.where(and(inArray(bookings.id, ids), eq(bookings.source, 'provisional')));
}

/** Brings the bookings of provisional due items in line with the item and the due item. */
async function refreshBookings(tx: Tx, item: RecurringItem, rows: DueItem[]) {
	const ids = rows.flatMap((r) => [r.bookingId, r.targetBookingId]).filter((id) => id !== null);
	if (!ids.length) return;
	const current = new Map(
		(await tx.select().from(bookings).where(inArray(bookings.id, ids))).map((b) => [b.id, b])
	);
	const fields = bookingFields(item);
	for (const row of rows) {
		for (const [id, accountId, amount] of [
			[row.bookingId, item.accountId, signed(item, row.amount)],
			[row.targetBookingId, item.targetAccountId, row.amount]
		] as const) {
			const b = id ? current.get(id) : undefined;
			// A side already confirmed by an import is left alone.
			if (!b || !accountId || b.source !== 'provisional') continue;
			const wanted = { ...fields, accountId, amount, bookingDate: row.bookingDate };
			const differs = (Object.keys(wanted) as (keyof typeof wanted)[]).some(
				(k) => b[k] !== wanted[k]
			);
			if (differs)
				await tx
					.update(bookings)
					.set({ ...wanted, updatedAt: new Date() })
					.where(eq(bookings.id, b.id));
		}
	}
}

/**
 * Provisionally books every due item that reached its bank day, from the latest of the item's
 * start and the opening date of its accounts. Runs at start, hourly and after changes; items or
 * accounts that are archived stay as they are. Pass ids to sync only those items.
 */
export async function syncDues(ids?: string[], today = todayBerlin()): Promise<number> {
	const changed = await syncDueItems(ids, today);
	// Savings goals transfer on the due days of their payments.
	await syncGoals(today);
	// Credit card statements are debited from their giro accounts.
	await syncSettlements(today);
	// Transfers into and out of savings accounts change their interest.
	await syncInterest(undefined, today);
	return changed;
}

async function syncDueItems(ids: string[] | undefined, today: string): Promise<number> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext('kontoplaner.due-sync'))`);
		const items = await tx
			.select()
			.from(recurringItems)
			.where(
				and(
					isNull(recurringItems.archivedAt),
					ids ? inArray(recurringItems.id, ids.length ? ids : ['']) : undefined
				)
			);
		if (!items.length) return 0;
		const itemIds = items.map((i) => i.id);
		const [amountRows, accountRows, dueRows] = await Promise.all([
			tx.select().from(recurringAmounts).where(inArray(recurringAmounts.recurringId, itemIds)),
			tx
				.select({
					id: accounts.id,
					openingDate: accounts.openingDate,
					archivedAt: accounts.archivedAt
				})
				.from(accounts),
			tx.select().from(dueItems).where(inArray(dueItems.recurringId, itemIds))
		]);
		const accountById = new Map(accountRows.map((a) => [a.id, a]));
		let changed = 0;
		for (const item of items) {
			const affected = [item.accountId, item.targetAccountId]
				.filter((id) => id !== null)
				.map((id) => accountById.get(id));
			if (affected.some((a) => !a || a.archivedAt !== null)) continue;
			const opening = affected
				.map((a) => a!.openingDate)
				.sort()
				.at(0)!;
			const from = item.startDate > opening ? item.startDate : opening;
			const amounts = amountRows.filter((a) => a.recurringId === item.id);
			const expected = duesUntil(item, amounts, from, today);
			const existing = dueRows.filter((d) => d.recurringId === item.id);
			const plan = reconcileDues(expected, existing);

			const removed = existing.filter((d) => plan.remove.includes(d.id));
			await deleteBookingsOf(tx, removed);
			if (removed.length)
				await tx.delete(dueItems).where(
					inArray(
						dueItems.id,
						removed.map((d) => d.id)
					)
				);
			for (const u of plan.update)
				await tx
					.update(dueItems)
					.set({ bookingDate: u.bookingDate, amount: u.amount, updatedAt: new Date() })
					.where(eq(dueItems.id, u.id));
			for (const c of plan.create) await createDue(tx, item, c);

			const provisional = await tx
				.select()
				.from(dueItems)
				.where(and(eq(dueItems.recurringId, item.id), eq(dueItems.status, 'provisional')));
			await refreshBookings(tx, item, provisional);

			const count = plan.create.length + plan.update.length + plan.remove.length;
			if (count) {
				changed += count;
				await audit(tx, {
					actor: null,
					entityType: 'recurring',
					action: 'due_sync',
					entityId: item.id,
					entityLabel: item.name,
					after: {
						dueCreated: plan.create.length,
						dueUpdated: plan.update.length,
						dueRemoved: plan.remove.length
					}
				});
			}
		}
		return changed;
	});
}

async function createDue(tx: Tx, item: RecurringItem, due: ExpectedDue) {
	const ids = await createBookings(tx, item, due);
	await tx.insert(dueItems).values({
		recurringId: item.id,
		dueDate: due.dueDate,
		bookingDate: due.bookingDate,
		amount: due.amount,
		...ids
	});
}

/** Removes provisional bookings and due items of an item (before deleting it). */
export async function deleteDuesOf(tx: Tx, recurringId: string) {
	const rows = await tx.select().from(dueItems).where(eq(dueItems.recurringId, recurringId));
	await deleteBookingsOf(tx, rows);
	await tx.delete(dueItems).where(eq(dueItems.recurringId, recurringId));
}

let timer: ReturnType<typeof setInterval> | undefined;

/** Background job: sync at start and every hour (the day changes at midnight in Berlin). */
export function startDueScheduler() {
	if (timer) return;
	const run = () => {
		void syncDues().catch((e: unknown) =>
			console.error('Fälligkeiten: Abgleich fehlgeschlagen', e)
		);
		void runNotifications().catch((e: unknown) =>
			console.error('Benachrichtigungen: Versand fehlgeschlagen', e)
		);
		void runMonthlyReports().catch((e: unknown) =>
			console.error('Monatsbericht: Versand fehlgeschlagen', e)
		);
		void purgeExpired().catch((e: unknown) =>
			console.error('Papierkorb: Aufräumen fehlgeschlagen', e)
		);
	};
	void run();
	timer = setInterval(() => void run(), 60 * 60 * 1000);
	timer.unref?.();
}

// --- due items of one booking and their actions ----------------------------------------

export type DueInfo = DueItem & {
	recurringName: string;
	kind: RecurringItem['kind'];
	/** May skip, move or change the amount (manage right on the recurring item). */
	canManage: boolean;
};

/** The due item behind a provisional booking, or null. */
export async function dueForBooking(viewer: Viewer, bookingId: string): Promise<DueInfo | null> {
	const [row] = await db
		.select()
		.from(dueItems)
		.where(or(eq(dueItems.bookingId, bookingId), eq(dueItems.targetBookingId, bookingId)));
	if (!row) return null;
	return withRights(viewer, row);
}

async function withRights(viewer: Viewer, row: DueItem): Promise<DueInfo | null> {
	const item = await getRecurringFor(viewer, row.recurringId);
	if (!item) return null;
	return { ...row, recurringName: item.name, kind: item.kind, canManage: item.canManage };
}

/** Latest stored due items of a recurring item, newest first. */
export async function recentDues(recurringId: string, limit = 6): Promise<DueItem[]> {
	return db
		.select()
		.from(dueItems)
		.where(eq(dueItems.recurringId, recurringId))
		.orderBy(desc(dueItems.dueDate))
		.limit(limit);
}

async function requireManageable(viewer: Viewer, id: string) {
	const [row] = await db.select().from(dueItems).where(eq(dueItems.id, id));
	const due = row ? await withRights(viewer, row) : null;
	if (!due) throw new DueError('Fälligkeit nicht gefunden.');
	if (!due.canManage) throw new DueError('Du darfst diese Fälligkeit nicht ändern.');
	const [item] = await db
		.select()
		.from(recurringItems)
		.where(eq(recurringItems.id, due.recurringId));
	return { due, item };
}

function label(due: DueInfo) {
	return due.recurringName;
}

/** "Zurücknehmen": the due item counts as skipped; its provisional bookings disappear. */
export async function skipDue(actor: NonNullable<Actor> & Viewer, id: string) {
	const { due } = await requireManageable(actor, id);
	if (due.status !== 'provisional')
		throw new DueError('Nur vorläufige Buchungen lassen sich zurücknehmen.');
	await db.transaction(async (tx) => {
		await deleteBookingsOf(tx, [due]);
		await tx
			.update(dueItems)
			.set({ status: 'skipped', bookingId: null, targetBookingId: null, updatedAt: new Date() })
			.where(eq(dueItems.id, id));
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'skip',
			entityId: id,
			entityLabel: label(due),
			before: { dueDate: due.dueDate, bookingDate: due.bookingDate, amount: due.amount }
		});
	});
}

/** Undoes "Zurücknehmen": books the due item provisionally again. */
export async function restoreDue(actor: NonNullable<Actor> & Viewer, id: string) {
	const { due, item } = await requireManageable(actor, id);
	if (due.status !== 'skipped') throw new DueError('Die Fälligkeit ist nicht zurückgenommen.');
	await db.transaction(async (tx) => {
		const ids = await createBookings(tx, item, due);
		await tx
			.update(dueItems)
			.set({ status: 'provisional', ...ids, updatedAt: new Date() })
			.where(eq(dueItems.id, id));
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'restore',
			entityId: id,
			entityLabel: label(due),
			after: { dueDate: due.dueDate, bookingDate: due.bookingDate, amount: due.amount }
		});
	});
}

/** Changes date and/or amount of a provisional due item by hand ("Verschieben", "Betrag anpassen"). */
export async function changeDue(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	change: { bookingDate?: string; amount?: number }
) {
	const { due, item } = await requireManageable(actor, id);
	if (due.status !== 'provisional')
		throw new DueError('Nur vorläufige Buchungen lassen sich ändern.');
	if (change.bookingDate !== undefined && !isValidDate(change.bookingDate))
		throw new DueError('Bitte ein Datum wählen.');
	if (change.amount !== undefined && !(change.amount > 0))
		throw new DueError('Bitte einen Betrag größer 0 eingeben.');
	const next = {
		bookingDate: change.bookingDate ?? due.bookingDate,
		amount: change.amount ?? due.amount
	};
	if (next.bookingDate === due.bookingDate && next.amount === due.amount) return;
	await db.transaction(async (tx) => {
		const [row] = await tx
			.update(dueItems)
			.set({
				...next,
				moved: due.moved || next.bookingDate !== due.bookingDate,
				amountSet: due.amountSet || next.amount !== due.amount,
				updatedAt: new Date()
			})
			.where(eq(dueItems.id, id))
			.returning();
		await refreshBookings(tx, item, [row]);
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		if (next.bookingDate !== due.bookingDate) {
			before.bookingDate = due.bookingDate;
			after.bookingDate = next.bookingDate;
		}
		if (next.amount !== due.amount) {
			before.amount = due.amount;
			after.amount = next.amount;
		}
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'update',
			entityId: due.bookingId ?? id,
			entityLabel: label(due),
			before,
			after
		});
	});
}

/** Stored due items of the given items in a date range (for upcoming lists). */
export async function storedDues(itemIds: string[], from: string) {
	if (!itemIds.length) return [];
	return db
		.select()
		.from(dueItems)
		.where(and(inArray(dueItems.recurringId, itemIds), sql`${dueItems.bookingDate} >= ${from}`))
		.orderBy(asc(dueItems.bookingDate));
}
