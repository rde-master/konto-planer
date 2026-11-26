// A booking the import did not recognise is assigned to its recurring item by hand – and
// released again. The assignment fulfils the nearest open due date like an imported row.
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookings, dueItems, recurringAliases, recurringItems } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import type { Viewer } from './account-rules.js';
import { getBookingFor, type BookingSummary } from './bookings.js';
import { getRecurringFor } from './recurring.js';
import { fulfilDue, learnAlias, loadContext } from './imports.js';
import { syncDues } from './due.js';
import { syncInterest } from './interest.js';
import { syncSettlements } from './credit-cards.js';
import { analyzeRows, sideOf } from '../import-match.js';
import { canBecomeRecurring } from '../recurring-from-booking.js';

export class AssignError extends Error {}

/** Real payments of an item that can be released from it again. */
export function canUnassign(b: Pick<BookingSummary, 'source' | 'recurringId' | 'canTag'>): boolean {
	return b.canTag && b.recurringId !== null && (b.source === 'manual' || b.source === 'import');
}

/** Recurring items the booking can be assigned to: on its account, in its direction, active. */
export async function assignOptions(
	booking: Pick<BookingSummary, 'accountId' | 'amount' | 'source' | 'recurringId' | 'canTag'> & {
		counterBookingId: string | null;
	}
): Promise<{ value: string; label: string }[]> {
	if (!booking.canTag || !canBecomeRecurring(booking)) return [];
	const items = await db
		.select()
		.from(recurringItems)
		.where(
			and(
				isNull(recurringItems.archivedAt),
				or(
					eq(recurringItems.accountId, booking.accountId),
					eq(recurringItems.targetAccountId, booking.accountId)
				)
			)
		);
	const sign = booking.amount < 0 ? -1 : 1;
	return items
		.filter((i) => sideOf(i, booking.accountId) === sign)
		.map((i) => ({ value: i.id, label: i.name }))
		.sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

/** Name of the item a real payment belongs to (for the booking page). */
export async function assignedItem(
	booking: Pick<BookingSummary, 'recurringId'>
): Promise<{ id: string; name: string } | null> {
	if (!booking.recurringId) return null;
	const [item] = await db
		.select({ id: recurringItems.id, name: recurringItems.name })
		.from(recurringItems)
		.where(eq(recurringItems.id, booking.recurringId));
	return item ?? null;
}

/**
 * "Dauerposten zuordnen": the booking belongs to the item from now on. The nearest open due
 * date (±31 days) counts as paid, its provisional booking goes, and the payee's name is
 * remembered for the next import.
 */
export async function assignBooking(
	actor: NonNullable<Actor> & Viewer,
	bookingId: string,
	recurringId: string
): Promise<{ name: string; dueDate: string | null }> {
	const booking = await getBookingFor(actor, bookingId);
	if (!booking) throw new AssignError('Buchung nicht gefunden.');
	if (!booking.canTag || !canBecomeRecurring(booking))
		throw new AssignError('Diese Buchung lässt sich keinem Dauerposten zuordnen.');
	const result = await db.transaction(async (tx) => {
		await tx.execute(sql`select id from accounts where id = ${booking.accountId} for update`);
		// The booking as a row of a file: the import's own logic picks the due date.
		const row = {
			line: 1,
			accountIban: '',
			bookingDate: booking.bookingDate,
			valueDate: booking.valueDate,
			counterparty: booking.counterparty,
			counterpartyIban: booking.iban,
			bookingText: booking.bookingText,
			purpose: booking.purpose,
			amount: booking.amount,
			balanceAfter: null,
			note: null,
			bankCategory: null,
			creditorId: booking.creditorId,
			mandateReference: booking.mandateReference,
			checksum: `assign:${booking.id}`,
			assign: recurringId
		};
		const { ctx, itemById } = await loadContext(tx, booking.accountId, [row]);
		const [analyzed] = analyzeRows([row], ctx);
		const match = analyzed.recurring;
		const item = match ? itemById.get(match.id) : undefined;
		if (!match || !item || match.via !== 'manual')
			throw new AssignError('Dieser Dauerposten passt nicht zur Buchung.');
		await tx
			.update(bookings)
			.set({
				recurringId: item.id,
				categoryId: booking.categoryId ?? item.categoryId,
				updatedAt: new Date()
			})
			.where(eq(bookings.id, booking.id));
		if (match.due) await fulfilDue(tx, item, booking.accountId, booking.id, match.due);
		await learnAlias(tx, actor, item, booking.counterparty);
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'update',
			entityId: booking.id,
			entityLabel: booking.counterparty ?? booking.purpose ?? 'Buchung',
			after: { assignedTo: item.name }
		});
		return { name: item.name, dueDate: match.due?.dueDate ?? null };
	});
	// A provisional booking may be gone: balances that depend on it follow.
	await syncInterest([booking.accountId]);
	await syncSettlements();
	return result;
}

/**
 * "Zuordnung lösen": the booking no longer belongs to its item. The due date it paid is open
 * again (and booked provisionally if its day has come).
 */
export async function unassignBooking(
	actor: NonNullable<Actor> & Viewer,
	bookingId: string
): Promise<{ name: string }> {
	const booking = await getBookingFor(actor, bookingId);
	if (!booking) throw new AssignError('Buchung nicht gefunden.');
	if (!canUnassign(booking) || !booking.recurringId)
		throw new AssignError(
			'Diese Buchung gehört zu keinem Dauerposten, von dem sie sich lösen lässt.'
		);
	const recurringId = booking.recurringId;
	const name = await db.transaction(async (tx) => {
		const [item] = await tx
			.select({ id: recurringItems.id, name: recurringItems.name })
			.from(recurringItems)
			.where(eq(recurringItems.id, recurringId));
		const dues = await tx
			.select()
			.from(dueItems)
			.where(or(eq(dueItems.bookingId, booking.id), eq(dueItems.targetBookingId, booking.id)));
		for (const due of dues) {
			const other = due.bookingId === booking.id ? due.targetBookingId : due.bookingId;
			// Without a booking on the other side the due date starts over.
			if (other === null) await tx.delete(dueItems).where(eq(dueItems.id, due.id));
			else
				await tx
					.update(dueItems)
					.set({
						[due.bookingId === booking.id ? 'bookingId' : 'targetBookingId']: null,
						updatedAt: new Date()
					})
					.where(eq(dueItems.id, due.id));
		}
		await tx
			.update(bookings)
			.set({ recurringId: null, updatedAt: new Date() })
			.where(eq(bookings.id, booking.id));
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'update',
			entityId: booking.id,
			entityLabel: booking.counterparty ?? booking.purpose ?? 'Buchung',
			after: { unassignedFrom: item?.name ?? '–' }
		});
		return item?.name ?? 'Dauerposten';
	});
	await syncDues([recurringId]);
	return { name };
}

/** Payee names the import knows the item by (learned from assignments by hand). */
export async function listAliases(recurringId: string): Promise<{ id: string; name: string }[]> {
	const rows = await db
		.select({ id: recurringAliases.id, name: recurringAliases.name })
		.from(recurringAliases)
		.where(eq(recurringAliases.recurringId, recurringId));
	return rows.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Forgets a learned name: the import no longer recognises the item by it. */
export async function removeAlias(
	actor: NonNullable<Actor> & Viewer,
	recurringId: string,
	aliasId: string
) {
	const item = await getRecurringFor(actor, recurringId);
	if (!item) throw new AssignError('Dauerposten nicht gefunden.');
	if (!item.canEdit) throw new AssignError('Du darfst diesen Dauerposten nicht bearbeiten.');
	if (!/^[0-9a-f-]{36}$/i.test(aliasId)) throw new AssignError('Name nicht gefunden.');
	await db.transaction(async (tx) => {
		const [gone] = await tx
			.delete(recurringAliases)
			.where(and(eq(recurringAliases.id, aliasId), eq(recurringAliases.recurringId, item.id)))
			.returning();
		if (!gone) throw new AssignError('Name nicht gefunden.');
		await audit(tx, {
			actor,
			entityType: 'recurring',
			action: 'update',
			entityId: item.id,
			entityLabel: item.name,
			before: { importName: gone.name }
		});
	});
}
