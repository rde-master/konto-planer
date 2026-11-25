import { and, eq, gte, inArray, isNull } from 'drizzle-orm';
import { db } from './db/index.js';
import {
	accounts,
	bookings,
	dueItems,
	recurringAmounts,
	recurringItems,
	subscriptionHints
} from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { listAccountsFor } from './accounts.js';
import { createRecurring } from './recurring.js';
import {
	WATCH_DAYS,
	nextAfter,
	paidMore,
	priceIncreases,
	type PriceIncrease,
	type WatchedItem
} from '../watch.js';
import type { Interval } from '../recurring.js';
import { addDays } from '../recurring.js';
import { todayBerlin } from '../dates.js';

export class WatchError extends Error {}

/** Price increases of active expenses on the given accounts (recent or announced). */
export async function increasesOn(
	accountIds: string[],
	today = todayBerlin()
): Promise<(PriceIncrease & { accountId: string })[]> {
	if (!accountIds.length) return [];
	const items = await db
		.select()
		.from(recurringItems)
		.innerJoin(accounts, eq(accounts.id, recurringItems.accountId))
		.where(
			and(
				inArray(recurringItems.accountId, accountIds),
				eq(recurringItems.kind, 'expense'),
				isNull(recurringItems.archivedAt),
				isNull(accounts.archivedAt)
			)
		);
	if (!items.length) return [];
	const ids = items.map((i) => i.recurring_items.id);
	const [amounts, paid] = await Promise.all([
		db.select().from(recurringAmounts).where(inArray(recurringAmounts.recurringId, ids)),
		db
			.select({
				recurringId: dueItems.recurringId,
				dueDate: dueItems.dueDate,
				amount: bookings.amount
			})
			.from(dueItems)
			.innerJoin(bookings, eq(bookings.id, dueItems.bookingId))
			.where(
				and(
					inArray(dueItems.recurringId, ids),
					eq(dueItems.status, 'booked'),
					eq(bookings.source, 'import'),
					gte(dueItems.dueDate, addDays(today, -WATCH_DAYS))
				)
			)
	]);
	const watched: WatchedItem[] = items.map(({ recurring_items: i }) => ({
		...i,
		amounts: amounts.filter((a) => a.recurringId === i.id)
	}));
	const accountOf = new Map(items.map((i) => [i.recurring_items.id, i.recurring_items.accountId]));
	return [
		...priceIncreases(watched, today),
		...paidMore(
			watched,
			paid.map((p) => ({ recurringId: p.recurringId, dueDate: p.dueDate, paid: -p.amount })),
			today
		)
	]
		.map((x) => ({ ...x, accountId: accountOf.get(x.recurringId)! }))
		.sort((a, b) => b.from.localeCompare(a.from));
}

/** Open "Neues Abo?" hints of the accounts the viewer sees. */
export async function hintsFor(viewer: Viewer) {
	const visible = (await listAccountsFor(viewer)).filter((a) => !a.archivedAt);
	if (!visible.length) return [];
	const rows = await db
		.select()
		.from(subscriptionHints)
		.where(
			and(
				inArray(
					subscriptionHints.accountId,
					visible.map((a) => a.id)
				),
				eq(subscriptionHints.status, 'open')
			)
		);
	const byId = new Map(visible.map((a) => [a.id, a]));
	return rows
		.map((h) => {
			const account = byId.get(h.accountId)!;
			return {
				...h,
				accountName: account.name,
				canEdit: canEditAccount(account.level, false)
			};
		})
		.sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

async function requireHint(actor: Viewer, id: string) {
	const hint = (await hintsFor(actor)).find((h) => h.id === id);
	if (!hint) throw new WatchError('Diesen Hinweis gibt es nicht mehr.');
	if (!hint.canEdit) throw new WatchError('Du darfst auf diesem Konto nichts ändern.');
	return hint;
}

/** "Als Dauerposten anlegen": starts with the next expected debit after today. */
export async function createFromHint(actor: NonNullable<Actor> & Viewer, id: string) {
	const hint = await requireHint(actor, id);
	const interval = hint.interval as Exclude<Interval, 'custom' | 'once'>;
	const schedule = { interval, customEvery: null, customUnit: null };
	const startDate = nextAfter(schedule, hint.lastDate, todayBerlin());
	if (!startDate) throw new WatchError('Für diesen Rhythmus gibt es keine nächste Fälligkeit.');
	const recurringId = await createRecurring(
		actor,
		{
			accountId: hint.accountId,
			kind: 'expense',
			targetAccountId: null,
			name: hint.name,
			counterparty: hint.name,
			iban: hint.iban,
			mandateReference: null,
			creditorId: null,
			categoryId: null,
			...schedule,
			startDate,
			endDate: null,
			variable: false,
			isSalary: false,
			paymentMethod: 'direct_debit',
			customerNumber: null,
			note: null
		},
		hint.amount
	);
	await db
		.update(subscriptionHints)
		.set({ status: 'created', recurringId, updatedAt: new Date() })
		.where(eq(subscriptionHints.id, id));
	return { recurringId, name: hint.name };
}

/** "Ignorieren": the payee is not suggested again on this account. */
export async function dismissHint(actor: NonNullable<Actor> & Viewer, id: string) {
	const hint = await requireHint(actor, id);
	await db.transaction(async (tx) => {
		await tx
			.update(subscriptionHints)
			.set({ status: 'dismissed', updatedAt: new Date() })
			.where(eq(subscriptionHints.id, id));
		await audit(tx, {
			actor,
			entityType: 'account',
			action: 'update',
			entityId: hint.accountId,
			entityLabel: hint.accountName,
			after: { subscriptionHint: `ignoriert: ${hint.name}` }
		});
	});
	return hint.name;
}
