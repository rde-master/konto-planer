import { and, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import {
	accounts,
	bookings,
	cardSettlements,
	recurringAmounts,
	recurringItems
} from './db/schema.js';
import { audit } from './audit.js';
import { openPayments, type PlannedItem } from '../due.js';
import { pendingSettlements, type CardEvent, type Settlement } from '../credit-card.js';
import { addDays } from '../recurring.js';
import { formatDay, todayBerlin } from '../dates.js';

type Card = typeof accounts.$inferSelect & {
	settlementAccountId: string;
	statementDay: number;
	debitDay: number;
};

/** Active credit cards with a settlement giro account (optionally only those of given accounts). */
async function settledCards(
	accountIds?: string[]
): Promise<{ card: Card; giro: typeof accounts.$inferSelect }[]> {
	const rows = await db
		.select()
		.from(accounts)
		.where(and(eq(accounts.type, 'kreditkarte'), isNull(accounts.archivedAt)));
	const cards = rows.filter(
		(c): c is Card =>
			c.settlementAccountId !== null &&
			c.statementDay !== null &&
			c.debitDay !== null &&
			(!accountIds || accountIds.includes(c.id) || accountIds.includes(c.settlementAccountId))
	);
	if (!cards.length) return [];
	const giros = await db
		.select()
		.from(accounts)
		.where(
			inArray(
				accounts.id,
				cards.map((c) => c.settlementAccountId)
			)
		);
	return cards
		.map((card) => ({ card, giro: giros.find((g) => g.id === card.settlementAccountId)! }))
		.filter((x) => x.giro && x.giro.type === 'giro' && !x.giro.archivedAt);
}

/** Planned payments of the card (its own items and transfers from or to it). */
async function cardItems(cardId: string): Promise<PlannedItem[]> {
	const items = await db
		.select()
		.from(recurringItems)
		.where(
			and(
				isNull(recurringItems.archivedAt),
				or(eq(recurringItems.accountId, cardId), eq(recurringItems.targetAccountId, cardId))
			)
		);
	if (!items.length) return [];
	const amounts = await db
		.select()
		.from(recurringAmounts)
		.where(
			inArray(
				recurringAmounts.recurringId,
				items.map((i) => i.id)
			)
		);
	return items.map((i) => ({
		...i,
		amounts: amounts.filter((a) => a.recurringId === i.id)
	}));
}

/** All movements of a card from its opening date on, plus expected payments up to `until`. */
async function cardEvents(card: Card, today: string, until: string): Promise<CardEvent[]> {
	const [booked, items] = await Promise.all([
		db
			.select({ date: bookings.bookingDate, amount: bookings.amount })
			.from(bookings)
			.where(and(eq(bookings.accountId, card.id), gte(bookings.bookingDate, card.openingDate))),
		cardItems(card.id)
	]);
	const expected =
		until > today
			? openPayments(items, new Set([card.id]), addDays(today, 1), until).map((p) => ({
					date: p.bookingDate,
					amount: p.amount
				}))
			: [];
	return [...booked, ...expected];
}

async function storedStatements(cardId: string): Promise<Set<string>> {
	const rows = await db
		.select({ statementDate: cardSettlements.statementDate })
		.from(cardSettlements)
		.where(eq(cardSettlements.cardAccountId, cardId));
	return new Set(rows.map((r) => r.statementDate));
}

async function pendingFor(card: Card, today: string, until: string): Promise<Settlement[]> {
	const [events, stored] = await Promise.all([
		cardEvents(card, today, until),
		storedStatements(card.id)
	]);
	return pendingSettlements(card, events, stored, until);
}

type StoredRow = typeof cardSettlements.$inferSelect & {
	giroSource: string | null;
	cardSource: string | null;
};

async function storedRows(cardId: string): Promise<StoredRow[]> {
	const rows = await db
		.select()
		.from(cardSettlements)
		.where(eq(cardSettlements.cardAccountId, cardId));
	const ids = rows.flatMap((r) => [r.giroBookingId, r.cardBookingId]).filter((id) => id !== null);
	const sources = ids.length
		? await db
				.select({ id: bookings.id, source: bookings.source })
				.from(bookings)
				.where(inArray(bookings.id, ids))
		: [];
	const sourceOf = new Map(sources.map((b) => [b.id, b.source as string]));
	return rows.map((r) => ({
		...r,
		giroSource: r.giroBookingId ? (sourceOf.get(r.giroBookingId) ?? null) : null,
		cardSource: r.cardBookingId ? (sourceOf.get(r.cardBookingId) ?? null) : null
	}));
}

/** Still computed: nothing to settle, or both bookings untouched (no import replaced one). */
function isOpen(r: StoredRow): boolean {
	if (!r.giroBookingId && !r.cardBookingId) return r.amount === 0;
	return r.giroSource === 'settlement' && r.cardSource === 'settlement';
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function bookSettlement(
	tx: Tx,
	card: Card,
	giro: { id: string; name: string },
	s: Settlement
) {
	const purpose = `Kreditkartenabrechnung vom ${formatDay(s.statementDate)}`;
	const [out] = await tx
		.insert(bookings)
		.values({
			accountId: giro.id,
			bookingDate: s.debitDate,
			amount: -s.amount,
			counterparty: card.name,
			purpose,
			source: 'settlement'
		})
		.returning({ id: bookings.id });
	const [into] = await tx
		.insert(bookings)
		.values({
			accountId: card.id,
			bookingDate: s.debitDate,
			amount: s.amount,
			counterparty: giro.name,
			purpose,
			source: 'settlement',
			counterBookingId: out.id
		})
		.returning({ id: bookings.id });
	await tx.update(bookings).set({ counterBookingId: into.id }).where(eq(bookings.id, out.id));
	return { giroBookingId: out.id, cardBookingId: into.id };
}

/**
 * Books every settlement whose debit day has come: the statement balance moves from the giro
 * account to the card (two linked bookings). Settlements no import has replaced yet follow
 * later card bookings (like provisional bookings). Runs with the due sync and after bookings.
 */
export async function syncSettlements(today = todayBerlin()): Promise<number> {
	let changed = 0;
	for (const { card, giro } of await settledCards()) {
		await db.transaction(async (tx) => {
			await tx.execute(sql`select pg_advisory_xact_lock(hashtext('kontoplaner.card-sync'))`);
			const rows = await storedRows(card.id);
			const open = new Map(rows.filter(isOpen).map((r) => [r.statementDate, r]));
			const openBookings = new Set(
				[...open.values()].map((r) => r.cardBookingId).filter((id) => id !== null)
			);
			const fixed = new Set(rows.filter((r) => !isOpen(r)).map((r) => r.statementDate));
			const booked = await tx
				.select({ id: bookings.id, date: bookings.bookingDate, amount: bookings.amount })
				.from(bookings)
				.where(and(eq(bookings.accountId, card.id), gte(bookings.bookingDate, card.openingDate)));
			const events = booked.filter((b) => !openBookings.has(b.id));
			const due = pendingSettlements(card, events, fixed, today).filter(
				(s) => s.debitDate <= today
			);
			for (const s of due) {
				const current = open.get(s.statementDate);
				if (current && current.amount === s.amount && current.debitDate === s.debitDate) continue;
				if (current) {
					const ids = [current.giroBookingId, current.cardBookingId].filter((id) => id !== null);
					if (ids.length) await tx.delete(bookings).where(inArray(bookings.id, ids));
				}
				const ids = s.amount > 0 ? await bookSettlement(tx, card, giro, s) : null;
				const values = {
					debitDate: s.debitDate,
					amount: s.amount,
					giroBookingId: ids?.giroBookingId ?? null,
					cardBookingId: ids?.cardBookingId ?? null
				};
				if (current)
					await tx.update(cardSettlements).set(values).where(eq(cardSettlements.id, current.id));
				else
					await tx
						.insert(cardSettlements)
						.values({ cardAccountId: card.id, statementDate: s.statementDate, ...values });
				changed++;
				await audit(tx, {
					actor: null,
					entityType: 'account',
					action: 'update',
					entityId: card.id,
					entityLabel: card.name,
					...(current ? { before: { amount: current.amount } } : {}),
					after: {
						cardSettlement: formatDay(s.statementDate),
						amount: s.amount,
						settlementAccount: giro.name
					}
				});
			}
		});
	}
	return changed;
}

export type SettlementEvent = { date: string; amount: number; label: string };

/**
 * Future settlements (debit day after today, up to `until`) as events per account: negative on
 * the giro account, positive on the card.
 */
export async function settlementEvents(
	accountIds: string[],
	today: string,
	until: string
): Promise<Map<string, SettlementEvent[]>> {
	const out = new Map<string, SettlementEvent[]>();
	if (until <= today) return out;
	const add = (id: string, e: SettlementEvent) => out.set(id, [...(out.get(id) ?? []), e]);
	for (const { card, giro } of await settledCards(accountIds)) {
		for (const s of await pendingFor(card, today, until)) {
			if (s.debitDate <= today || s.debitDate > until || !s.amount) continue;
			const label = `Kreditkarte ${card.name}`;
			add(giro.id, { date: s.debitDate, amount: -s.amount, label });
			add(card.id, { date: s.debitDate, amount: s.amount, label: `Abbuchung von ${giro.name}` });
		}
	}
	return out;
}

/** Next settlements of one card for its account page. */
export async function nextSettlements(cardId: string, today = todayBerlin(), count = 2) {
	const [entry] = await settledCards([cardId]).then((l) => l.filter((x) => x.card.id === cardId));
	if (!entry) return [];
	const pending = await pendingFor(entry.card, today, addDays(today, 70));
	return pending
		.filter((s) => s.debitDate > today)
		.slice(0, count)
		.map((s) => ({ ...s, giroName: entry.giro.name }));
}
