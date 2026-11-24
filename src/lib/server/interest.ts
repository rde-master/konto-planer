import { and, asc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import {
	accountInterestRates,
	accounts,
	bookings,
	interestCredits,
	type InterestCredit
} from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { getAccountFor, type AccountWithLevel } from './accounts.js';
import { listRecurringFor } from './recurring.js';
import { computeInterest, formatRate, periodEnd, type InterestRhythm } from '../interest.js';
import { openPayments } from '../due.js';
import { addDays } from '../recurring.js';
import { todayBerlin } from '../dates.js';

export class InterestError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Pick<typeof db, 'select'>;

/** Bookings that change the balance (interest credits are computed separately). */
async function balanceEvents(executor: Executor, account: { id: string; openingDate: string }) {
	return executor
		.select({ date: bookings.bookingDate, amount: bookings.amount })
		.from(bookings)
		.where(
			and(
				eq(bookings.accountId, account.id),
				gte(bookings.bookingDate, account.openingDate),
				ne(bookings.source, 'interest')
			)
		);
}

async function ratesOf(executor: Executor, accountId: string) {
	return executor
		.select({
			id: accountInterestRates.id,
			rate: accountInterestRates.rate,
			validFrom: accountInterestRates.validFrom
		})
		.from(accountInterestRates)
		.where(eq(accountInterestRates.accountId, accountId))
		.orderBy(asc(accountInterestRates.validFrom));
}

async function insertCreditBooking(
	tx: Tx,
	account: { id: string },
	credit: { periodEnd: string; amount: number }
) {
	const [b] = await tx
		.insert(bookings)
		.values({
			accountId: account.id,
			bookingDate: credit.periodEnd,
			amount: credit.amount,
			source: 'interest',
			purpose: 'Zinsen'
		})
		.returning({ id: bookings.id });
	return b.id;
}

/**
 * Books the interest of every finished period of active savings accounts with a rate
 * (provisionally, source "interest"). Credits set by hand stay as they are. Runs with the
 * due-item sync (start, hourly, after changes) and after rate changes.
 */
export async function syncInterest(ids?: string[], today = todayBerlin()): Promise<number> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext('kontoplaner.interest-sync'))`);
		const list = await tx
			.select()
			.from(accounts)
			.where(
				and(
					eq(accounts.type, 'sparbuch'),
					isNull(accounts.archivedAt),
					ids
						? inArray(accounts.id, ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
						: undefined
				)
			);
		let changed = 0;
		for (const account of list) {
			const [rates, existing] = await Promise.all([
				ratesOf(tx, account.id),
				tx.select().from(interestCredits).where(eq(interestCredits.accountId, account.id))
			]);
			if (!rates.length && !existing.length) continue;
			const fixed = new Map(
				existing.filter((c) => c.amountSet).map((c) => [c.periodEnd, c.amount])
			);
			const { credits } = computeInterest({
				openingBalance: account.openingBalance,
				start: account.openingDate,
				until: today,
				rhythm: account.interestRhythm,
				rates,
				events: await balanceEvents(tx, account),
				fixed
			});
			const wanted = new Map(credits.map((c) => [c.periodEnd, c.amount]));
			const byEnd = new Map(existing.map((c) => [c.periodEnd, c]));
			let created = 0;
			let updated = 0;
			let removed = 0;
			for (const [end, amount] of wanted) {
				const cur = byEnd.get(end);
				if (!cur) {
					const bookingId = await insertCreditBooking(tx, account, { periodEnd: end, amount });
					await tx
						.insert(interestCredits)
						.values({ accountId: account.id, periodEnd: end, amount, bookingId });
					created++;
				} else if (!cur.amountSet && cur.amount !== amount) {
					await tx
						.update(interestCredits)
						.set({ amount, updatedAt: new Date() })
						.where(eq(interestCredits.id, cur.id));
					if (cur.bookingId)
						await tx
							.update(bookings)
							.set({ amount, updatedAt: new Date() })
							.where(eq(bookings.id, cur.bookingId));
					updated++;
				}
			}
			for (const cur of existing)
				if (!wanted.has(cur.periodEnd) && !cur.amountSet) {
					if (cur.bookingId) await tx.delete(bookings).where(eq(bookings.id, cur.bookingId));
					await tx.delete(interestCredits).where(eq(interestCredits.id, cur.id));
					removed++;
				}
			if (created + updated + removed) {
				changed += created + updated + removed;
				await audit(tx, {
					actor: null,
					entityType: 'account',
					action: 'interest_credit',
					entityId: account.id,
					entityLabel: account.name,
					after: { creditsCreated: created, creditsUpdated: updated, creditsRemoved: removed }
				});
			}
		}
		return changed;
	});
}

export type InterestInfo = {
	rhythm: InterestRhythm;
	rates: { id: string; rate: number; validFrom: string }[];
	currentRate: number;
	/** Interest accrued in the running period up to today (cents, rounded). */
	accrued: number;
	/** Expected credit at the end of the running period, with known transfers until then. */
	expected: { date: string; amount: number };
	/** End-of-day balances for the chart (last 12 months, or since the opening date). */
	series: [string, number][];
};

/** Interest overview and balance history of a savings account. */
export async function interestInfo(
	viewer: Viewer,
	account: AccountWithLevel
): Promise<InterestInfo> {
	const today = todayBerlin();
	const [rates, events, credits, items] = await Promise.all([
		ratesOf(db, account.id),
		balanceEvents(db, account),
		db.select().from(interestCredits).where(eq(interestCredits.accountId, account.id)),
		listRecurringFor(viewer)
	]);
	const fixed = new Map(credits.map((c) => [c.periodEnd, c.amount]));
	const base = {
		openingBalance: account.openingBalance,
		start: account.openingDate,
		rhythm: account.interestRhythm,
		rates
	};
	const now = computeInterest({ ...base, until: today, events, fixed });
	const end = periodEnd(account.interestRhythm, today);
	const future = openPayments(
		items.filter((i) => !i.archivedAt),
		new Set([account.id]),
		addDays(today, 1),
		end
	).map((p) => ({ date: p.bookingDate, amount: p.amount }));
	const forecast = computeInterest({ ...base, until: end, events: [...events, ...future], fixed });
	const expected =
		end === today
			? (credits.find((c) => c.periodEnd === end)?.amount ?? Math.round(now.accrued))
			: (forecast.credits.find((c) => c.periodEnd === end)?.amount ?? 0);

	// Balance history: events plus booked credits, from max(opening, one year ago).
	const from = [account.openingDate, addDays(today, -365)].sort().at(-1)!;
	const all = [...events, ...credits.map((c) => ({ date: c.periodEnd, amount: c.amount }))].sort(
		(a, b) => a.date.localeCompare(b.date)
	);
	let balance = account.openingBalance;
	let i = 0;
	for (; i < all.length && all[i].date < from; i++) balance += all[i].amount;
	const series: [string, number][] = [];
	for (let day = from; day <= today; day = addDays(day, 1)) {
		for (; i < all.length && all[i].date === day; i++) balance += all[i].amount;
		series.push([day, balance]);
	}
	return {
		rhythm: account.interestRhythm,
		rates,
		currentRate: rates.filter((r) => r.validFrom <= today).at(-1)?.rate ?? 0,
		accrued: Math.round(now.accrued),
		expected: { date: end, amount: expected },
		series
	};
}

async function requireEditableSavings(actor: Viewer, accountId: string) {
	const account = await getAccountFor(actor, accountId);
	if (
		!account ||
		account.type !== 'sparbuch' ||
		!canEditAccount(account.level, account.archivedAt !== null)
	)
		throw new InterestError('Die Zinsen dieses Kontos darfst du nicht ändern.');
	return account;
}

function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23505' || err?.cause?.code === '23505';
}

/** Adds a rate valid from a day (past or future). */
export async function addRate(
	actor: NonNullable<Actor> & Viewer,
	accountId: string,
	entry: { rate: number; validFrom: string }
) {
	const account = await requireEditableSavings(actor, accountId);
	try {
		await db.transaction(async (tx) => {
			await tx.insert(accountInterestRates).values({ accountId, ...entry });
			await audit(tx, {
				actor,
				entityType: 'account',
				action: 'interest_rate',
				entityId: accountId,
				entityLabel: account.name,
				after: { interestRate: formatRate(entry.rate), validFrom: entry.validFrom }
			});
		});
	} catch (e) {
		if (isUniqueViolation(e))
			throw new InterestError('Für dieses Datum gibt es schon einen Zinssatz.');
		throw e;
	}
	await syncInterest([accountId]);
}

export async function deleteRate(
	actor: NonNullable<Actor> & Viewer,
	accountId: string,
	rateId: string
) {
	const account = await requireEditableSavings(actor, accountId);
	const [rate] = await db
		.select()
		.from(accountInterestRates)
		.where(and(eq(accountInterestRates.id, rateId), eq(accountInterestRates.accountId, accountId)));
	if (!rate) throw new InterestError('Zinssatz nicht gefunden.');
	await db.transaction(async (tx) => {
		await tx.delete(accountInterestRates).where(eq(accountInterestRates.id, rateId));
		await audit(tx, {
			actor,
			entityType: 'account',
			action: 'interest_rate',
			entityId: accountId,
			entityLabel: account.name,
			before: { interestRate: formatRate(rate.rate), validFrom: rate.validFrom }
		});
	});
	await syncInterest([accountId]);
}

/** Changes how often interest is credited. */
export async function setRhythm(
	actor: NonNullable<Actor> & Viewer,
	accountId: string,
	rhythm: InterestRhythm
) {
	const account = await requireEditableSavings(actor, accountId);
	if (account.interestRhythm === rhythm) return;
	await db.transaction(async (tx) => {
		await tx
			.update(accounts)
			.set({ interestRhythm: rhythm, updatedAt: new Date() })
			.where(eq(accounts.id, accountId));
		await audit(tx, {
			actor,
			entityType: 'account',
			action: 'update',
			entityId: accountId,
			entityLabel: account.name,
			before: { interestRhythm: account.interestRhythm },
			after: { interestRhythm: rhythm }
		});
	});
	await syncInterest([accountId]);
}

// --- a credit behind a booking ---------------------------------------------------------

export type CreditInfo = InterestCredit & { canEdit: boolean };

export async function creditForBooking(
	viewer: Viewer,
	bookingId: string
): Promise<CreditInfo | null> {
	const [credit] = await db
		.select()
		.from(interestCredits)
		.where(eq(interestCredits.bookingId, bookingId));
	if (!credit) return null;
	const account = await getAccountFor(viewer, credit.accountId);
	if (!account) return null;
	return { ...credit, canEdit: canEditAccount(account.level, account.archivedAt !== null) };
}

/** Sets the credit to the amount of the bank (or back to the computed one with `null`). */
export async function setCreditAmount(
	actor: NonNullable<Actor> & Viewer,
	creditId: string,
	amount: number | null
) {
	const [credit] = await db.select().from(interestCredits).where(eq(interestCredits.id, creditId));
	const account = credit ? await requireEditableSavings(actor, credit.accountId) : null;
	if (!credit || !account) throw new InterestError('Zinsgutschrift nicht gefunden.');
	if (amount !== null && !(amount > 0))
		throw new InterestError('Bitte einen Betrag größer 0 eingeben.');
	await db.transaction(async (tx) => {
		await tx
			.update(interestCredits)
			.set({ amount: amount ?? credit.amount, amountSet: amount !== null, updatedAt: new Date() })
			.where(eq(interestCredits.id, creditId));
		if (amount !== null && credit.bookingId)
			await tx
				.update(bookings)
				.set({ amount, updatedAt: new Date() })
				.where(eq(bookings.id, credit.bookingId));
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'update',
			entityId: credit.bookingId ?? creditId,
			entityLabel: `Zinsen ${account.name}`,
			before: { amount: credit.amount },
			after: { amount: amount ?? 'berechnet' }
		});
	});
	await syncInterest([credit.accountId]);
}
