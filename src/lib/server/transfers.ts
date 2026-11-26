// Transfers between two accounts made by hand: a booking is linked with its other side on
// another account (found there or created), and released again.
import { and, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { accounts, bookings } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import type { Viewer } from './account-rules.js';
import { getAccountFor } from './accounts.js';
import { getBookingFor, type BookingSummary } from './bookings.js';
import { snapshotBooking, toTrash } from './trash.js';
import { syncInterest } from './interest.js';
import { syncSettlements } from './credit-cards.js';
import { addDays } from '../recurring.js';
import { TRANSFER_WINDOW, canLinkTransfer, pickCounter } from '../transfers.js';

export class TransferError extends Error {}

type Linkable = Pick<
	BookingSummary,
	'source' | 'recurringId' | 'counterBookingId' | 'amount' | 'canTag' | 'accountId'
>;

/** Accounts a booking can be transferred with: every other active account, by name only. */
export async function counterAccounts(
	exceptId?: string
): Promise<{ value: string; label: string }[]> {
	const rows = await db
		.select({ id: accounts.id, name: accounts.name })
		.from(accounts)
		.where(isNull(accounts.archivedAt));
	return rows
		.filter((a) => a.id !== exceptId)
		.map((a) => ({ value: a.id, label: a.name }))
		.sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

/** Options for "Als Umbuchung kennzeichnen" (empty if the booking cannot become one). */
export async function transferOptions(booking: Linkable) {
	if (!booking.canTag || !canLinkTransfer(booking)) return [];
	return counterAccounts(booking.accountId);
}

/** A counter booking made by the app (not a real row of the other account's bank export). */
function isMade(b: { source: string; checksum: string | null }): boolean {
	return b.source === 'manual' || (b.source === 'import' && b.checksum === null);
}

/** The other side of a transfer for the booking page. `bookingId` only if the viewer sees it. */
export async function transferOf(
	viewer: Viewer,
	booking: Pick<BookingSummary, 'counterBookingId' | 'source' | 'canTag'>
): Promise<{
	accountName: string;
	bookingId: string | null;
	/** The booking can be released from the transfer. */
	canRelease: boolean;
	/** Releasing may delete the other side (it was created by the app). */
	canRemove: boolean;
} | null> {
	if (!booking.counterBookingId) return null;
	const [other] = await db
		.select({
			id: bookings.id,
			accountId: bookings.accountId,
			source: bookings.source,
			checksum: bookings.checksum,
			accountName: accounts.name
		})
		.from(bookings)
		.innerJoin(accounts, eq(accounts.id, bookings.accountId))
		.where(eq(bookings.id, booking.counterBookingId));
	if (!other) return null;
	const visible = (await getAccountFor(viewer, other.accountId)) !== null;
	const real = (s: string) => s === 'manual' || s === 'import';
	const canRelease = booking.canTag && real(booking.source) && real(other.source);
	return {
		accountName: other.accountName,
		bookingId: visible ? other.id : null,
		canRelease,
		canRemove: canRelease && isMade(other)
	};
}

/**
 * "Als Umbuchung kennzeichnen": links the booking with its other side on the chosen account.
 * A booking there with the opposite amount within ±3 days is taken (only on accounts the
 * actor sees); otherwise the counter booking is created.
 */
export async function linkTransfer(
	actor: NonNullable<Actor> & Viewer,
	bookingId: string,
	counterAccountId: string
): Promise<{ accountName: string; created: boolean }> {
	const booking = await getBookingFor(actor, bookingId);
	if (!booking) throw new TransferError('Buchung nicht gefunden.');
	if (!booking.canTag || !canLinkTransfer(booking))
		throw new TransferError('Diese Buchung lässt sich nicht als Umbuchung kennzeichnen.');
	if (!/^[0-9a-f-]{36}$/i.test(counterAccountId) || counterAccountId === booking.accountId)
		throw new TransferError('Bitte ein anderes Konto wählen.');
	const [target] = await db
		.select()
		.from(accounts)
		.where(and(eq(accounts.id, counterAccountId), isNull(accounts.archivedAt)));
	if (!target) throw new TransferError('Bitte ein anderes Konto wählen.');
	const visible = (await getAccountFor(actor, target.id)) !== null;

	const created = await db.transaction(async (tx) => {
		await tx.execute(
			sql`select id from accounts where id in (${booking.accountId}, ${target.id}) order by id for update`
		);
		const [fresh] = await tx
			.select({ counterBookingId: bookings.counterBookingId })
			.from(bookings)
			.where(eq(bookings.id, booking.id));
		if (!fresh || fresh.counterBookingId)
			throw new TransferError('Diese Buchung ist schon eine Umbuchung.');
		const candidates = visible
			? await tx
					.select({ id: bookings.id, date: bookings.bookingDate, amount: bookings.amount })
					.from(bookings)
					.where(
						and(
							eq(bookings.accountId, target.id),
							ne(bookings.id, booking.id),
							isNull(bookings.counterBookingId),
							isNull(bookings.recurringId),
							inArray(bookings.source, ['manual', 'import']),
							gte(bookings.bookingDate, addDays(booking.bookingDate, -TRANSFER_WINDOW)),
							lte(bookings.bookingDate, addDays(booking.bookingDate, TRANSFER_WINDOW))
						)
					)
			: [];
		const existing = pickCounter({ date: booking.bookingDate, amount: booking.amount }, candidates);
		let counterId = existing?.id;
		if (!counterId) {
			const [counter] = await tx
				.insert(bookings)
				.values({
					accountId: target.id,
					bookingDate: booking.bookingDate,
					valueDate: booking.valueDate,
					amount: -booking.amount,
					counterparty: booking.account.name,
					purpose: booking.purpose ?? 'Umbuchung',
					source: 'manual',
					createdBy: actor.id
				})
				.returning({ id: bookings.id });
			counterId = counter.id;
		}
		await tx
			.update(bookings)
			.set({ counterBookingId: booking.id, updatedAt: new Date() })
			.where(eq(bookings.id, counterId));
		await tx
			.update(bookings)
			.set({ counterBookingId: counterId, updatedAt: new Date() })
			.where(eq(bookings.id, booking.id));
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'update',
			entityId: booking.id,
			entityLabel: booking.counterparty ?? booking.purpose ?? 'Buchung',
			after: { transferWith: target.name, counterBooking: existing ? 'verknüpft' : 'angelegt' }
		});
		return !existing;
	});
	// A new booking on a savings account or a card changes interest and statements.
	await syncInterest([booking.accountId, target.id]);
	await syncSettlements();
	return { accountName: target.name, created };
}

/**
 * "Umbuchung auflösen": both bookings stand alone again. With `remove` the other side goes to
 * the trash, if the app created it (never a real row of a bank export).
 */
export async function releaseTransfer(
	actor: NonNullable<Actor> & Viewer,
	bookingId: string,
	remove: boolean
): Promise<{ accountName: string; removed: boolean }> {
	const booking = await getBookingFor(actor, bookingId);
	if (!booking) throw new TransferError('Buchung nicht gefunden.');
	const info = await transferOf(actor, booking);
	if (!info || !booking.counterBookingId)
		throw new TransferError('Diese Buchung ist keine Umbuchung.');
	if (!info.canRelease) throw new TransferError('Diese Umbuchung lässt sich nicht auflösen.');
	const counterId = booking.counterBookingId;
	const removed = remove && info.canRemove;
	const accountIds = await db.transaction(async (tx) => {
		const [counter] = await tx.select().from(bookings).where(eq(bookings.id, counterId));
		await tx
			.update(bookings)
			.set({ counterBookingId: null, updatedAt: new Date() })
			.where(inArray(bookings.id, [booking.id, counterId]));
		if (removed && counter) {
			await toTrash(tx, actor, {
				type: 'booking',
				id: counter.id,
				label: counter.counterparty ?? counter.purpose ?? 'Buchung',
				accountId: counter.accountId,
				snapshot: await snapshotBooking(tx, counter.id)
			});
			await tx.delete(bookings).where(eq(bookings.id, counter.id));
		}
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'update',
			entityId: booking.id,
			entityLabel: booking.counterparty ?? booking.purpose ?? 'Buchung',
			before: { transferWith: info.accountName },
			after: { counterBooking: removed ? 'gelöscht' : 'bleibt stehen' }
		});
		return [booking.accountId, ...(counter ? [counter.accountId] : [])];
	});
	await syncInterest(accountIds);
	await syncSettlements();
	return { accountName: info.accountName, removed };
}
