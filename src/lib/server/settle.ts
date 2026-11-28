import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { altNamesOf } from './alt-names.js';
import { db } from './db/index.js';
import { bookings, settlements, sharedExpenseShares, sharedExpenses, users } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { getAccountFor } from './accounts.js';
import { isValidDate } from './recurring-rules.js';
import type { FieldErrors } from './validation.js';
import {
	FULL,
	debts,
	formatPercent,
	netBalances,
	owedAmounts,
	parsePercent,
	type SettlementEntry
} from '../settle.js';
import { formatEuro, parseEuro } from '../money.js';

export class SettleError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** All users (for payer and participants). */
export async function settleUsers(): Promise<{ id: string; name: string }[]> {
	return db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name));
}

export type ShareInput = {
	payerId: string;
	participants: string[];
	percents: Record<string, string>;
};
export type ShareValues = { payerId: string; shares: Map<string, number> };

/** Payer and participants are users; percentages (if given) add up to 100 %. */
export function validateShares(
	input: ShareInput,
	userIds: Set<string>
): { values: ShareValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	if (!userIds.has(input.payerId)) errors.payerId = 'Bitte wählen, wer bezahlt hat.';
	const people = [...new Set(input.participants)].filter((id) => userIds.has(id));
	if (people.length < 1) errors.shares = 'Bitte mindestens eine beteiligte Person wählen.';
	const shares = new Map<string, number>();
	const typed = people.some((id) => (input.percents[id] ?? '').trim() !== '');
	if (typed) {
		for (const id of people) {
			const bp = parsePercent(input.percents[id] ?? '');
			if (bp === null) {
				errors.shares = 'Bitte Anteile in Prozent wie 50 oder 33,33 eingeben.';
				break;
			}
			shares.set(id, bp);
		}
		const sum = [...shares.values()].reduce((s, v) => s + v, 0);
		if (!errors.shares && sum !== FULL)
			errors.shares = `Die Anteile ergeben ${formatPercent(sum)} statt 100 %.`;
	} else {
		const base = Math.floor(FULL / Math.max(1, people.length));
		let rest = FULL - base * people.length;
		for (const id of people) {
			shares.set(id, base + (rest > 0 ? 1 : 0));
			if (rest > 0) rest--;
		}
	}
	if (Object.keys(errors).length) return { values: null, errors };
	return { values: { payerId: input.payerId, shares }, errors: null };
}

export type SharedInfo = {
	payerId: string;
	payerName: string;
	shares: { userId: string; name: string; share: number; owed: number }[];
};

/** The shared-expense data of a booking, or null. */
export async function sharedOf(bookingId: string, amount: number): Promise<SharedInfo | null> {
	const [row] = await db
		.select({ payerId: sharedExpenses.payerId, payerName: users.name })
		.from(sharedExpenses)
		.innerJoin(users, eq(users.id, sharedExpenses.payerId))
		.where(eq(sharedExpenses.bookingId, bookingId));
	if (!row) return null;
	const shares = await db
		.select({
			userId: sharedExpenseShares.userId,
			name: users.name,
			share: sharedExpenseShares.share
		})
		.from(sharedExpenseShares)
		.innerJoin(users, eq(users.id, sharedExpenseShares.userId))
		.where(eq(sharedExpenseShares.bookingId, bookingId))
		.orderBy(asc(users.name));
	const owed = owedAmounts(Math.abs(amount), new Map(shares.map((s) => [s.userId, s.share])));
	return {
		...row,
		shares: shares.map((s) => ({ ...s, owed: owed.get(s.userId) ?? 0 }))
	};
}

async function requireShareable(actor: Viewer, bookingId: string) {
	if (!UUID.test(bookingId)) throw new SettleError('Buchung nicht gefunden.');
	const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
	const account = booking ? await getAccountFor(actor, booking.accountId) : null;
	if (!booking || !account) throw new SettleError('Buchung nicht gefunden.');
	if (!canEditAccount(account.level, account.archivedAt !== null))
		throw new SettleError('Diese Buchung darfst du nicht ändern.');
	if (booking.amount >= 0 || (booking.source !== 'manual' && booking.source !== 'import'))
		throw new SettleError('Gemeinsam sein können nur Ausgaben (manuell oder importiert).');
	return booking;
}

async function auditText(executor: typeof db, payerId: string | null, shares: Map<string, number>) {
	if (!payerId) return null;
	const names = new Map(
		(await executor.select({ id: users.id, name: users.name }).from(users)).map((u) => [
			u.id,
			u.name
		])
	);
	const parts = [...shares].map(([id, bp]) => `${names.get(id) ?? '?'} ${formatPercent(bp)}`);
	return `bezahlt von ${names.get(payerId) ?? '?'}; ${parts.join(', ')}`;
}

/** Marks a booking as shared (or changes payer and shares). */
export async function setShared(
	actor: NonNullable<Actor> & Viewer,
	bookingId: string,
	values: ShareValues
) {
	const booking = await requireShareable(actor, bookingId);
	const before = await sharedOf(bookingId, booking.amount);
	await db.transaction(async (tx) => {
		await tx
			.insert(sharedExpenses)
			.values({ bookingId, payerId: values.payerId, createdBy: actor.id })
			.onConflictDoUpdate({
				target: sharedExpenses.bookingId,
				set: { payerId: values.payerId, updatedAt: new Date() }
			});
		await tx.delete(sharedExpenseShares).where(eq(sharedExpenseShares.bookingId, bookingId));
		await tx
			.insert(sharedExpenseShares)
			.values([...values.shares].map(([userId, share]) => ({ bookingId, userId, share })));
		const old = before
			? await auditText(db, before.payerId, new Map(before.shares.map((s) => [s.userId, s.share])))
			: null;
		const now = await auditText(db, values.payerId, values.shares);
		if (old !== now)
			await audit(tx, {
				actor,
				entityType: 'booking',
				action: 'update',
				entityId: bookingId,
				entityLabel: booking.counterparty ?? booking.purpose ?? 'Buchung',
				before: { sharedExpense: old },
				after: { sharedExpense: now }
			});
	});
}

export async function unsetShared(actor: NonNullable<Actor> & Viewer, bookingId: string) {
	const booking = await requireShareable(actor, bookingId);
	const before = await sharedOf(bookingId, booking.amount);
	if (!before) return;
	await db.transaction(async (tx) => {
		await tx.delete(sharedExpenses).where(eq(sharedExpenses.bookingId, bookingId));
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'update',
			entityId: bookingId,
			entityLabel: booking.counterparty ?? booking.purpose ?? 'Buchung',
			before: {
				sharedExpense: await auditText(
					db,
					before.payerId,
					new Map(before.shares.map((s) => [s.userId, s.share]))
				)
			},
			after: { sharedExpense: null }
		});
	});
}

export type SettleOverview = {
	/** Who pays whom (only payments involving the viewer). */
	debts: (SettlementEntry & { fromName: string; toName: string })[];
	/** The viewer's net: positive = gets money back. */
	net: number;
	expenses: {
		bookingId: string;
		date: string;
		label: string;
		/** Alternative name of the booking's recurring item (only with access to the account). */
		altName: string | null;
		amount: number;
		payerName: string;
		/** Viewer's share in cents (0 if only payer). */
		own: number;
		/** The viewer may open the booking (sees its account). */
		visible: boolean;
	}[];
	settlements: {
		id: string;
		date: string;
		fromName: string;
		toName: string;
		amount: number;
		note: string | null;
		canDelete: boolean;
	}[];
};

/** Shared expenses and settlements involving the viewer, with balances. */
export async function settleOverview(viewer: Viewer): Promise<SettleOverview> {
	const people = await settleUsers();
	const name = new Map(people.map((u) => [u.id, u.name]));
	const allShared = await db
		.select({
			bookingId: sharedExpenses.bookingId,
			payerId: sharedExpenses.payerId,
			amount: bookings.amount,
			date: bookings.bookingDate,
			counterparty: bookings.counterparty,
			purpose: bookings.purpose,
			recurringId: bookings.recurringId,
			accountId: bookings.accountId
		})
		.from(sharedExpenses)
		.innerJoin(bookings, eq(bookings.id, sharedExpenses.bookingId))
		.orderBy(desc(bookings.bookingDate));
	const shareRows = allShared.length
		? await db
				.select()
				.from(sharedExpenseShares)
				.where(
					inArray(
						sharedExpenseShares.bookingId,
						allShared.map((e) => e.bookingId)
					)
				)
		: [];
	const sharesOf = (id: string) =>
		new Map(shareRows.filter((s) => s.bookingId === id).map((s) => [s.userId, s.share]));
	const allSettlements = await db
		.select()
		.from(settlements)
		.orderBy(desc(settlements.date), desc(settlements.createdAt));
	// Balances over everything; the list shows what involves the viewer.
	const net = netBalances(
		allShared.map((e) => ({
			amount: Math.abs(e.amount),
			payerId: e.payerId,
			shares: sharesOf(e.bookingId)
		})),
		allSettlements
	);
	const mine = allShared.filter(
		(e) => e.payerId === viewer.id || sharesOf(e.bookingId).has(viewer.id)
	);
	const altNames = await altNamesOf(mine.map((e) => e.recurringId));
	const expenses = [];
	for (const e of mine) {
		const owed = owedAmounts(Math.abs(e.amount), sharesOf(e.bookingId));
		const visible = (await getAccountFor(viewer, e.accountId)) !== null;
		expenses.push({
			bookingId: e.bookingId,
			date: e.date,
			label: e.counterparty ?? e.purpose ?? 'Ausgabe',
			// The recurring item belongs to the account: only for those who see it.
			altName: visible ? (altNames.get(e.recurringId ?? '') ?? null) : null,
			amount: Math.abs(e.amount),
			payerName: name.get(e.payerId) ?? '?',
			own: owed.get(viewer.id) ?? 0,
			visible
		});
	}
	return {
		debts: debts(net)
			.filter((d) => d.fromUserId === viewer.id || d.toUserId === viewer.id)
			.map((d) => ({
				...d,
				fromName: name.get(d.fromUserId) ?? '?',
				toName: name.get(d.toUserId) ?? '?'
			})),
		net: net.get(viewer.id) ?? 0,
		expenses,
		settlements: allSettlements
			.filter((s) => s.fromUserId === viewer.id || s.toUserId === viewer.id)
			.map((s) => ({
				id: s.id,
				date: s.date,
				fromName: name.get(s.fromUserId) ?? '?',
				toName: name.get(s.toUserId) ?? '?',
				amount: s.amount,
				note: s.note,
				canDelete: viewer.role === 'admin' || s.createdBy === viewer.id
			}))
	};
}

export type SettlementInput = {
	fromUserId: string;
	toUserId: string;
	amount: string;
	date: string;
	note: string;
};

export function validateSettlement(
	input: SettlementInput,
	ctx: { userIds: Set<string>; viewerId: string; today: string }
):
	| {
			values: {
				fromUserId: string;
				toUserId: string;
				amount: number;
				date: string;
				note: string | null;
			};
			errors: null;
	  }
	| { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	if (!ctx.userIds.has(input.fromUserId)) errors.fromUserId = 'Bitte wählen, wer gezahlt hat.';
	if (!ctx.userIds.has(input.toUserId)) errors.toUserId = 'Bitte wählen, wer das Geld bekommt.';
	else if (input.toUserId === input.fromUserId)
		errors.toUserId = 'Zwei verschiedene Personen wählen.';
	else if (input.fromUserId !== ctx.viewerId && input.toUserId !== ctx.viewerId)
		errors.toUserId = 'Du kannst nur Ausgleiche erfassen, an denen du beteiligt bist.';
	const amount = parseEuro(input.amount);
	if (amount === null || amount <= 0) errors.amount = 'Bitte einen Betrag größer 0 eingeben.';
	if (!isValidDate(input.date)) errors.date = 'Bitte ein Datum wählen.';
	else if (input.date > ctx.today) errors.date = 'Das Datum darf nicht in der Zukunft liegen.';
	const note = input.note.trim().replace(/\s+/g, ' ') || null;
	if (note && note.length > 100) errors.note = 'Höchstens 100 Zeichen.';
	if (Object.keys(errors).length || amount === null) return { values: null, errors };
	return {
		values: {
			fromUserId: input.fromUserId,
			toUserId: input.toUserId,
			amount,
			date: input.date,
			note
		},
		errors: null
	};
}

export async function createSettlement(
	actor: NonNullable<Actor>,
	values: {
		fromUserId: string;
		toUserId: string;
		amount: number;
		date: string;
		note: string | null;
	}
) {
	await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(settlements)
			.values({ ...values, createdBy: actor.id })
			.returning();
		const names = new Map(
			(
				await tx
					.select({ id: users.id, name: users.name })
					.from(users)
					.where(or(eq(users.id, values.fromUserId), eq(users.id, values.toUserId)))
			).map((u) => [u.id, u.name])
		);
		await audit(tx, {
			actor,
			entityType: 'settlement',
			action: 'create',
			entityId: created.id,
			entityLabel: `${names.get(values.fromUserId)} → ${names.get(values.toUserId)}`,
			after: { amount: values.amount, date: values.date, note: values.note }
		});
	});
}

export async function deleteSettlement(actor: NonNullable<Actor> & Viewer, id: string) {
	if (!UUID.test(id)) throw new SettleError('Ausgleich nicht gefunden.');
	const [row] = await db.select().from(settlements).where(eq(settlements.id, id));
	if (!row) throw new SettleError('Ausgleich nicht gefunden.');
	if (actor.role !== 'admin' && row.createdBy !== actor.id)
		throw new SettleError('Diesen Ausgleich darfst du nicht löschen.');
	await db.transaction(async (tx) => {
		await tx.delete(settlements).where(and(eq(settlements.id, id)));
		await audit(tx, {
			actor,
			entityType: 'settlement',
			action: 'delete',
			entityId: id,
			entityLabel: formatEuro(row.amount),
			before: { amount: row.amount, date: row.date, note: row.note }
		});
	});
}
