// Payee report: bookings by payee, and the names the user put together as one payee.
import { and, asc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookings, payeeGroupMembers, payeeGroups, recurringItems } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { logoOf, logoOverrides } from './logos.js';
import type { LogoRef } from '../logos.js';
import {
	payeeTotals,
	splitSelection,
	type PayeeBooking,
	type PayeeGroupInfo,
	type PayeeTotal
} from '../payees.js';

export class PayeeError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME = 60;
/** Longest payee key taken from a form (names of banks are far shorter). */
const MAX_KEY = 200;

function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23505' || err?.cause?.code === '23505';
}

/**
 * Bookings of the accounts in a period with their payee: as written on the booking, otherwise
 * the payee or the name of its recurring item (provisional bookings).
 */
export async function payeeBookings(
	ids: string[],
	from: string,
	to: string
): Promise<PayeeBooking[]> {
	if (!ids.length) return [];
	const rows = await db
		.select({
			date: bookings.bookingDate,
			amount: bookings.amount,
			counterparty: bookings.counterparty,
			source: bookings.source,
			counterBookingId: bookings.counterBookingId,
			kind: recurringItems.kind,
			itemPayee: recurringItems.counterparty,
			itemName: recurringItems.name
		})
		.from(bookings)
		.leftJoin(recurringItems, eq(recurringItems.id, bookings.recurringId))
		.where(
			and(
				inArray(bookings.accountId, ids),
				gte(bookings.bookingDate, from),
				lte(bookings.bookingDate, to),
				// Corrections of the balance are no payments to anyone.
				ne(bookings.source, 'adjustment')
			)
		);
	return rows.map((r) => ({
		date: r.date,
		amount: r.amount,
		name: r.counterparty ?? r.itemPayee ?? r.itemName ?? null,
		// As in the other reports: goal transfers, counter bookings, transfer items.
		internal: r.source === 'goal' || r.counterBookingId !== null || r.kind === 'transfer'
	}));
}

/** All groups with the names that belong to them. */
export async function listPayeeGroups(): Promise<PayeeGroupInfo[]> {
	const [groups, members] = await Promise.all([
		db
			.select({ id: payeeGroups.id, name: payeeGroups.name })
			.from(payeeGroups)
			.orderBy(asc(sql`lower(${payeeGroups.name})`)),
		db
			.select({ key: payeeGroupMembers.key, groupId: payeeGroupMembers.groupId })
			.from(payeeGroupMembers)
	]);
	return groups.map((g) => ({
		...g,
		keys: members.filter((m) => m.groupId === g.id).map((m) => m.key)
	}));
}

export type PayeeRow = PayeeTotal & { logo: LogoRef | null };

/** The report: sums per payee of the accounts in the period, with logos. */
export async function payeeReport(ids: string[], from: string, to: string): Promise<PayeeRow[]> {
	const [rows, groups] = await Promise.all([payeeBookings(ids, from, to), listPayeeGroups()]);
	const totals = payeeTotals(rows, groups);
	const overrides = await logoOverrides(totals.flatMap((t) => t.members.map((m) => m.key)));
	return totals.map((t) => {
		// A group shows the logo of its name, else that of its largest payee.
		const first = t.members[0];
		const logo =
			(t.groupId ? logoOf(overrides, null, t.label) : null) ??
			(first.key ? logoOf(overrides, first.key, first.label) : null);
		return { ...t, logo };
	});
}

function cleanName(name: string): string {
	const clean = name.replace(/\s+/g, ' ').trim();
	if (!clean) throw new PayeeError('Bitte einen Namen eingeben.');
	if (clean.length > MAX_NAME) throw new PayeeError(`Höchstens ${MAX_NAME} Zeichen.`);
	return clean;
}

/**
 * "Zusammenfassen": the chosen payees (and groups) count as one under `name`. A group with
 * that name takes them in; otherwise the first chosen group is kept, or a new one is made.
 */
export async function mergePayees(
	actor: NonNullable<Actor>,
	name: string,
	ids: string[]
): Promise<{ name: string; count: number }> {
	const clean = cleanName(name);
	const chosen = splitSelection(ids);
	const keys = chosen.keys.filter((k) => k.length <= MAX_KEY);
	const groupIds = chosen.groupIds.filter((id) => UUID.test(id));
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext('kontoplaner.payee-groups'))`);
		const [named] = await tx
			.select()
			.from(payeeGroups)
			.where(eq(sql`lower(${payeeGroups.name})`, clean.toLowerCase()));
		const selected = groupIds.length
			? await tx.select().from(payeeGroups).where(inArray(payeeGroups.id, groupIds))
			: [];
		// Two payees – or one that joins the group already bearing the name.
		const sources = keys.length + selected.length;
		const joins = named !== undefined && !selected.some((g) => g.id === named.id);
		if (sources < 1 || (sources < 2 && !joins))
			throw new PayeeError('Bitte mindestens zwei Empfänger auswählen.');
		let target = named ?? selected[0];
		let action: 'create' | 'update' = 'update';
		if (!target) {
			[target] = await tx
				.insert(payeeGroups)
				.values({ name: clean, createdBy: actor.id })
				.returning();
			action = 'create';
		} else if (target.name !== clean)
			await tx
				.update(payeeGroups)
				.set({ name: clean, updatedAt: new Date() })
				.where(eq(payeeGroups.id, target.id));
		const kept = target.id;
		const absorbed = selected.filter((g) => g.id !== kept);
		if (absorbed.length) {
			const gone = absorbed.map((g) => g.id);
			await tx
				.update(payeeGroupMembers)
				.set({ groupId: target.id })
				.where(inArray(payeeGroupMembers.groupId, gone));
			await tx.delete(payeeGroups).where(inArray(payeeGroups.id, gone));
		}
		if (keys.length)
			await tx
				.insert(payeeGroupMembers)
				.values(keys.map((key) => ({ key, groupId: target.id })))
				.onConflictDoUpdate({ target: payeeGroupMembers.key, set: { groupId: target.id } });
		const [{ count }] = await tx
			.select({ count: sql<number>`count(*)::int` })
			.from(payeeGroupMembers)
			.where(eq(payeeGroupMembers.groupId, target.id));
		await audit(tx, {
			actor,
			entityType: 'payee_group',
			action,
			entityId: target.id,
			entityLabel: clean,
			after: {
				name: clean,
				payeeNames: count,
				...(absorbed.length ? { absorbed: absorbed.map((g) => g.name).join(', ') } : {})
			}
		});
		return { name: clean, count };
	});
}

export async function renamePayeeGroup(actor: NonNullable<Actor>, id: string, name: string) {
	const clean = cleanName(name);
	if (!UUID.test(id)) throw new PayeeError('Zusammenfassung nicht gefunden.');
	try {
		await db.transaction(async (tx) => {
			const [before] = await tx.select().from(payeeGroups).where(eq(payeeGroups.id, id));
			if (!before) throw new PayeeError('Zusammenfassung nicht gefunden.');
			if (before.name === clean) return;
			await tx
				.update(payeeGroups)
				.set({ name: clean, updatedAt: new Date() })
				.where(eq(payeeGroups.id, id));
			await audit(tx, {
				actor,
				entityType: 'payee_group',
				action: 'update',
				entityId: id,
				entityLabel: clean,
				before: { name: before.name },
				after: { name: clean }
			});
		});
	} catch (e) {
		if (isUniqueViolation(e)) throw new PayeeError('Diesen Namen gibt es schon.');
		throw e;
	}
}

/**
 * Takes one name out of a group (`key`), or dissolves the group (`key` null): the payees
 * stand on their own again. A group without names disappears.
 */
export async function splitPayees(
	actor: NonNullable<Actor>,
	id: string,
	key: string | null
): Promise<{ name: string; dissolved: boolean }> {
	if (!UUID.test(id)) throw new PayeeError('Zusammenfassung nicht gefunden.');
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext('kontoplaner.payee-groups'))`);
		const [group] = await tx.select().from(payeeGroups).where(eq(payeeGroups.id, id));
		if (!group) throw new PayeeError('Zusammenfassung nicht gefunden.');
		let dissolved = key === null;
		if (key !== null) {
			const [gone] = await tx
				.delete(payeeGroupMembers)
				.where(and(eq(payeeGroupMembers.groupId, id), eq(payeeGroupMembers.key, key)))
				.returning();
			if (!gone) throw new PayeeError('Dieser Name gehört nicht zur Zusammenfassung.');
			const [{ left }] = await tx
				.select({ left: sql<number>`count(*)::int` })
				.from(payeeGroupMembers)
				.where(eq(payeeGroupMembers.groupId, id));
			dissolved = left === 0;
		}
		if (dissolved) await tx.delete(payeeGroups).where(eq(payeeGroups.id, id));
		await audit(tx, {
			actor,
			entityType: 'payee_group',
			action: dissolved ? 'delete' : 'update',
			entityId: id,
			entityLabel: group.name,
			before: key !== null && !dissolved ? { payeeName: key } : { name: group.name }
		});
		return { name: group.name, dissolved };
	});
}
