import { and, asc, desc, eq, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import {
	accounts,
	bookings,
	dueItems,
	goalTransfers,
	recurringAmounts,
	recurringItems,
	savingsGoals,
	type GoalTransfer,
	type RecurringItem,
	type SavingsGoal
} from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { diff } from './audit-rules.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { getAccountFor, listAccountsFor, type AccountWithLevel } from './accounts.js';
import { balancesOf } from './bookings.js';
import { listRecurringFor } from './recurring.js';
import { syncInterest } from './interest.js';
import type { GoalValues, LinkablePayment } from './goal-rules.js';
import { freeAmount, nextGoalDue, progress, savingRate, transferAmount } from '../goals.js';
import type { PlanEvent } from '../minimum.js';
import { isReserveItem, reserveRate } from '../reserves.js';
import { amountOn, type AmountEntry } from '../recurring.js';
import { formatDay, todayBerlin } from '../dates.js';

export class GoalError extends Error {}

type Executor = Pick<typeof db, 'select'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LinkedItem = RecurringItem & { amounts: AmountEntry[]; accountName: string };

/** Linked payments with schedule and amounts (independent of the viewer: only names are shown). */
async function linkedItems(executor: Executor, ids: string[]): Promise<Map<string, LinkedItem>> {
	if (!ids.length) return new Map();
	const [items, amounts] = await Promise.all([
		executor
			.select({ item: recurringItems, accountName: accounts.name })
			.from(recurringItems)
			.innerJoin(accounts, eq(accounts.id, recurringItems.accountId))
			.where(inArray(recurringItems.id, ids)),
		executor.select().from(recurringAmounts).where(inArray(recurringAmounts.recurringId, ids))
	]);
	return new Map(
		items.map(({ item, accountName }) => [
			item.id,
			{
				...item,
				accountName,
				amounts: amounts
					.filter((a) => a.recurringId === item.id)
					.map(({ amount, validFrom }) => ({ amount, validFrom }))
					.sort((a, b) => a.validFrom.localeCompare(b.validFrom))
			}
		])
	);
}

async function transferredDates(executor: Executor, goalIds: string[]) {
	const rows = goalIds.length
		? await executor
				.select({ goalId: goalTransfers.goalId, dueDate: goalTransfers.dueDate })
				.from(goalTransfers)
				.where(inArray(goalTransfers.goalId, goalIds))
		: [];
	const out = new Map<string, Set<string>>();
	for (const r of rows) {
		if (!r.goalId) continue;
		if (!out.has(r.goalId)) out.set(r.goalId, new Set());
		out.get(r.goalId)!.add(r.dueDate);
	}
	return out;
}

/** Next transfer day of a linked goal (bank day of the next due item without a transfer). */
function nextDueOf(
	goal: SavingsGoal,
	item: LinkedItem | undefined,
	done: Set<string>,
	today: string
) {
	if (!item || item.archivedAt) return null;
	const from = goal.since > today ? goal.since : today;
	return nextGoalDue(item, item.amounts, from, done);
}

export type GoalSummary = SavingsGoal & {
	account: Pick<AccountWithLevel, 'id' | 'name' | 'color' | 'level' | 'archivedAt'>;
	payment: {
		id: string;
		name: string;
		accountName: string;
		once: boolean;
		/** Amount of the next due item. */
		amount: number | null;
	} | null;
	/** Effective target date: next due day of the payment, or the stored date. */
	date: string | null;
	/** Linked to a one-off payment that is paid, or to a payment without due dates. */
	done: boolean;
	progress: number;
	/** Per month; null without a date. */
	rate: number | null;
	/** Monthly reserve of a linked payment due every three months or less often. */
	reserve: number | null;
	canEdit: boolean;
};

function summarize(
	goal: SavingsGoal,
	account: AccountWithLevel,
	item: LinkedItem | undefined,
	done: Set<string>,
	today: string
): GoalSummary {
	const next = goal.recurringId ? nextDueOf(goal, item, done, today) : null;
	const date = goal.recurringId ? (next?.bookingDate ?? null) : goal.targetDate;
	const finished = goal.recurringId !== null && next === null;
	return {
		...goal,
		account: {
			id: account.id,
			name: account.name,
			color: account.color,
			level: account.level,
			archivedAt: account.archivedAt
		},
		payment: item
			? {
					id: item.id,
					name: item.name,
					accountName: item.accountName,
					once: item.interval === 'once',
					amount: next?.amount ?? amountOn(item.amounts, today)
				}
			: null,
		date,
		done: finished,
		progress: progress(goal.targetAmount, goal.allocated),
		rate: finished ? null : savingRate(goal.targetAmount, goal.allocated, today, date),
		reserve:
			item && !finished && isReserveItem(item)
				? reserveRate(next?.amount ?? goal.targetAmount, item)
				: null,
		canEdit: canEditAccount(account.level, account.archivedAt !== null)
	};
}

/** Goals on the savings accounts the viewer can see (optionally of one account or payment). */
export async function listGoalsFor(
	viewer: Viewer,
	filter: { accountId?: string; recurringId?: string } = {}
): Promise<GoalSummary[]> {
	const visible = (await listAccountsFor(viewer)).filter((a) => a.type === 'sparbuch');
	const ids = visible.map((a) => a.id).filter((id) => !filter.accountId || id === filter.accountId);
	if (!ids.length) return [];
	const goals = await db
		.select()
		.from(savingsGoals)
		.where(
			and(
				inArray(savingsGoals.accountId, ids),
				filter.recurringId ? eq(savingsGoals.recurringId, filter.recurringId) : undefined
			)
		)
		.orderBy(asc(savingsGoals.name));
	const items = await linkedItems(
		db,
		goals.map((g) => g.recurringId).filter((id) => id !== null)
	);
	const done = await transferredDates(
		db,
		goals.map((g) => g.id)
	);
	const today = todayBerlin();
	const byId = new Map(visible.map((a) => [a.id, a]));
	return goals
		.map((g) =>
			summarize(
				g,
				byId.get(g.accountId)!,
				g.recurringId ? items.get(g.recurringId) : undefined,
				done.get(g.id) ?? new Set(),
				today
			)
		)
		.sort(
			(a, b) =>
				Number(a.done) - Number(b.done) ||
				(a.date ?? '9999').localeCompare(b.date ?? '9999') ||
				a.name.localeCompare(b.name, 'de')
		);
}

export type GoalDetail = GoalSummary & {
	transfers: GoalTransfer[];
	/** Free balance of the savings account plus this goal's own allocation. */
	free: number;
	balance: number;
};

export async function getGoalFor(viewer: Viewer, id: string): Promise<GoalDetail | null> {
	if (!UUID.test(id)) return null;
	const [goal] = await db.select().from(savingsGoals).where(eq(savingsGoals.id, id));
	if (!goal) return null;
	const account = await getAccountFor(viewer, goal.accountId);
	if (!account) return null;
	const items = await linkedItems(db, goal.recurringId ? [goal.recurringId] : []);
	const transfers = await db
		.select()
		.from(goalTransfers)
		.where(eq(goalTransfers.goalId, id))
		.orderBy(desc(goalTransfers.dueDate));
	const { balance, free } = await freeOf(account, id);
	return {
		...summarize(
			goal,
			account,
			goal.recurringId ? items.get(goal.recurringId) : undefined,
			new Set(transfers.map((t) => t.dueDate)),
			todayBerlin()
		),
		transfers,
		free,
		balance
	};
}

/** Balance of a savings account and what is not set aside (ignoring the goal `except`). */
export async function freeOf(
	account: { id: string; openingBalance: number; openingDate: string },
	except?: string
) {
	const balance = (await balancesOf([account])).get(account.id) ?? 0;
	const rows = await db
		.select({ id: savingsGoals.id, allocated: savingsGoals.allocated })
		.from(savingsGoals)
		.where(eq(savingsGoals.accountId, account.id));
	return {
		balance,
		free: freeAmount(
			balance,
			rows.filter((r) => r.id !== except).map((r) => r.allocated)
		)
	};
}

/** Savings account summary: balance, set aside and free. */
export async function goalTotals(account: AccountWithLevel, goals: GoalSummary[]) {
	const balance = (await balancesOf([account])).get(account.id) ?? 0;
	const allocated = goals.reduce((s, g) => s + g.allocated, 0);
	return { balance, allocated, free: balance - allocated };
}

/** Expenses on giro accounts the viewer can see, for linking (validation and select options). */
export async function linkablePayments(viewer: Viewer, keep?: string | null) {
	const today = todayBerlin();
	const items = (await listRecurringFor(viewer)).filter(
		(i) =>
			i.kind === 'expense' &&
			i.account.type === 'giro' &&
			(i.id === keep || (!i.archivedAt && !i.account.archivedAt))
	);
	const map = new Map<string, LinkablePayment>();
	const options: { value: string; label: string; amount: number | null }[] = [];
	for (const i of items) {
		const next = nextGoalDue(i, i.amounts, today, new Set());
		map.set(i.id, { amount: next?.amount ?? i.amount, next: next?.bookingDate ?? null });
		if (!next && i.id !== keep) continue;
		options.push({
			value: i.id,
			label: `${i.name} · ${i.account.name}${next ? ` · ${formatDay(next.bookingDate)}` : ''}`,
			amount: next?.amount ?? i.amount
		});
	}
	return { map, options };
}

/** Active savings accounts the viewer may edit (where goals can be created). */
export async function goalAccounts(viewer: Viewer) {
	return (await listAccountsFor(viewer)).filter(
		(a) => a.type === 'sparbuch' && canEditAccount(a.level, a.archivedAt !== null)
	);
}

function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23505' || err?.cause?.code === '23505';
}

const NAME_TAKEN = 'Ein Sparziel mit diesem Namen gibt es auf dem Sparbuch schon.';

async function paymentName(executor: Executor, id: string | null) {
	if (!id) return null;
	const [row] = await executor
		.select({ name: recurringItems.name })
		.from(recurringItems)
		.where(eq(recurringItems.id, id));
	return row?.name ?? null;
}

async function auditFields(executor: Executor, g: GoalValues) {
	return {
		name: g.name,
		targetAmount: g.targetAmount,
		targetDate: g.targetDate,
		payment: await paymentName(executor, g.recurringId),
		allocated: g.allocated
	};
}

async function requireEditableAccount(viewer: Viewer, accountId: string) {
	const account = await getAccountFor(viewer, accountId);
	if (!account || account.type !== 'sparbuch')
		throw new GoalError('Sparziele gibt es nur auf Sparbüchern.');
	if (!canEditAccount(account.level, account.archivedAt !== null))
		throw new GoalError('Auf diesem Sparbuch darfst du keine Sparziele ändern.');
	return account;
}

/** After a change: a linked payment due today gets its transfer right away. */
async function afterChange() {
	if (await syncGoals()) await syncInterest();
}

export async function createGoal(
	actor: NonNullable<Actor> & Viewer,
	accountId: string,
	values: GoalValues
): Promise<string> {
	await requireEditableAccount(actor, accountId);
	let id: string;
	try {
		id = await db.transaction(async (tx) => {
			const [created] = await tx
				.insert(savingsGoals)
				.values({ ...values, accountId, since: todayBerlin(), createdBy: actor.id })
				.returning();
			await audit(tx, {
				actor,
				entityType: 'goal',
				action: 'create',
				entityId: created.id,
				entityLabel: created.name,
				after: await auditFields(tx, values)
			});
			return created.id;
		});
	} catch (e) {
		if (isUniqueViolation(e)) throw new GoalError(NAME_TAKEN);
		throw e;
	}
	await afterChange();
	return id;
}

async function requireEditableGoal(viewer: Viewer, id: string) {
	const goal = await getGoalFor(viewer, id);
	if (!goal) throw new GoalError('Sparziel nicht gefunden.');
	if (!goal.canEdit) throw new GoalError('Dieses Sparziel darfst du nicht ändern.');
	return goal;
}

export async function updateGoal(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	values: GoalValues
) {
	const goal = await requireEditableGoal(actor, id);
	try {
		await db.transaction(async (tx) => {
			await tx
				.update(savingsGoals)
				.set({
					...values,
					// A newly linked payment only gets transfers from today on.
					since: values.recurringId !== goal.recurringId ? todayBerlin() : goal.since,
					updatedAt: new Date()
				})
				.where(eq(savingsGoals.id, id));
			const changes = diff(await auditFields(tx, goal), await auditFields(tx, values));
			if (changes)
				await audit(tx, {
					actor,
					entityType: 'goal',
					action: 'update',
					entityId: id,
					entityLabel: values.name,
					...changes
				});
		});
	} catch (e) {
		if (isUniqueViolation(e)) throw new GoalError(NAME_TAKEN);
		throw e;
	}
	await afterChange();
}

/** "Zuteilen": sets the part of the balance set aside for the goal. */
export async function allocateGoal(actor: NonNullable<Actor> & Viewer, id: string, amount: number) {
	const goal = await requireEditableGoal(actor, id);
	if (amount === goal.allocated) return;
	await db.transaction(async (tx) => {
		await tx
			.update(savingsGoals)
			.set({ allocated: amount, updatedAt: new Date() })
			.where(eq(savingsGoals.id, id));
		await audit(tx, {
			actor,
			entityType: 'goal',
			action: 'allocate',
			entityId: id,
			entityLabel: goal.name,
			before: { allocated: goal.allocated },
			after: { allocated: amount }
		});
	});
	await afterChange();
}

/** Deleting a goal keeps its transfers (they are real bookings). */
export async function deleteGoal(actor: NonNullable<Actor> & Viewer, id: string) {
	const goal = await requireEditableGoal(actor, id);
	await db.transaction(async (tx) => {
		await tx.delete(savingsGoals).where(eq(savingsGoals.id, id));
		await audit(tx, {
			actor,
			entityType: 'goal',
			action: 'delete',
			entityId: id,
			entityLabel: goal.name,
			before: await auditFields(tx, goal)
		});
	});
	return goal.accountId;
}

// --- transfers on the due day ------------------------------------------------------------

function purposeOf(name: string) {
	return `Sparziel „${name}“`;
}

/**
 * Books the transfer of each linked goal on every due day of its payment (from `since` up to
 * today): what is set aside, at most the target, goes from the savings account to the paying
 * giro account, and the allocation shrinks by it. Returns the number of new transfers.
 */
export async function syncGoals(today = todayBerlin()): Promise<number> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext('kontoplaner.goal-sync'))`);
		const goals = await tx.select().from(savingsGoals).where(isNotNull(savingsGoals.recurringId));
		if (!goals.length) return 0;
		const items = await linkedItems(
			tx,
			goals.map((g) => g.recurringId!)
		);
		const accountRows = await tx
			.select({ id: accounts.id, archivedAt: accounts.archivedAt })
			.from(accounts);
		const archived = new Set(accountRows.filter((a) => a.archivedAt).map((a) => a.id));
		const done = await transferredDates(
			tx,
			goals.map((g) => g.id)
		);
		let count = 0;
		for (const goal of goals) {
			const item = items.get(goal.recurringId!);
			if (!item || archived.has(goal.accountId) || archived.has(item.accountId)) continue;
			const dues = await tx
				.select({ dueDate: dueItems.dueDate, bookingDate: dueItems.bookingDate })
				.from(dueItems)
				.where(
					and(
						eq(dueItems.recurringId, item.id),
						ne(dueItems.status, 'skipped'),
						sql`${dueItems.bookingDate} >= ${goal.since}`,
						sql`${dueItems.bookingDate} <= ${today}`
					)
				)
				.orderBy(asc(dueItems.dueDate));
			const seen = done.get(goal.id) ?? new Set();
			let allocated = goal.allocated;
			for (const due of dues) {
				if (seen.has(due.dueDate)) continue;
				const amount = transferAmount(allocated, goal.targetAmount);
				let ids: { bookingId: string | null; targetBookingId: string | null } = {
					bookingId: null,
					targetBookingId: null
				};
				if (amount > 0) {
					const common = {
						bookingDate: due.bookingDate,
						source: 'goal' as const,
						purpose: purposeOf(goal.name)
					};
					const [out] = await tx
						.insert(bookings)
						.values({ ...common, accountId: goal.accountId, amount: -amount })
						.returning({ id: bookings.id });
					const [inn] = await tx
						.insert(bookings)
						.values({ ...common, accountId: item.accountId, amount })
						.returning({ id: bookings.id });
					ids = { bookingId: out.id, targetBookingId: inn.id };
				}
				await tx.insert(goalTransfers).values({
					goalId: goal.id,
					dueDate: due.dueDate,
					bookingDate: due.bookingDate,
					amount,
					...ids
				});
				allocated -= amount;
				count++;
				await audit(tx, {
					actor: null,
					entityType: 'goal',
					action: 'goal_transfer',
					entityId: goal.id,
					entityLabel: goal.name,
					before: { allocated: goal.allocated },
					after: { bookingDate: due.bookingDate, amount, allocated }
				});
			}
			if (allocated !== goal.allocated)
				await tx
					.update(savingsGoals)
					.set({ allocated, updatedAt: new Date() })
					.where(eq(savingsGoals.id, goal.id));
		}
		return count;
	});
}

export type GoalTransferInfo = GoalTransfer & {
	goalName: string | null;
	/** The goal if the viewer can see it. */
	goalVisible: boolean;
	/** May take it back: edit right on the savings account. */
	canUndo: boolean;
};

/** The goal transfer behind a booking (either side), or null. */
export async function goalTransferForBooking(
	viewer: Viewer,
	bookingId: string
): Promise<GoalTransferInfo | null> {
	const [row] = await db
		.select({ transfer: goalTransfers, goal: savingsGoals })
		.from(goalTransfers)
		.leftJoin(savingsGoals, eq(savingsGoals.id, goalTransfers.goalId))
		.where(
			or(eq(goalTransfers.bookingId, bookingId), eq(goalTransfers.targetBookingId, bookingId))
		);
	if (!row) return null;
	const [source] = row.transfer.bookingId
		? await db
				.select({ accountId: bookings.accountId })
				.from(bookings)
				.where(eq(bookings.id, row.transfer.bookingId))
		: [];
	const account = source ? await getAccountFor(viewer, source.accountId) : null;
	return {
		...row.transfer,
		goalName: row.goal?.name ?? null,
		goalVisible: account !== null && row.goal !== null,
		canUndo:
			row.transfer.status === 'booked' &&
			account !== null &&
			canEditAccount(account.level, account.archivedAt !== null)
	};
}

/** "Zurücknehmen": removes both bookings; the amount counts as set aside again. */
export async function undoGoalTransfer(actor: NonNullable<Actor> & Viewer, bookingId: string) {
	const t = await goalTransferForBooking(actor, bookingId);
	if (!t) throw new GoalError('Umbuchung nicht gefunden.');
	if (!t.canUndo) throw new GoalError('Diese Umbuchung darfst du nicht zurücknehmen.');
	await db.transaction(async (tx) => {
		const ids = [t.bookingId, t.targetBookingId].filter((id) => id !== null);
		if (ids.length)
			await tx.delete(bookings).where(and(inArray(bookings.id, ids), eq(bookings.source, 'goal')));
		await tx
			.update(goalTransfers)
			.set({ status: 'skipped', bookingId: null, targetBookingId: null })
			.where(eq(goalTransfers.id, t.id));
		if (t.goalId)
			await tx
				.update(savingsGoals)
				.set({ allocated: sql`${savingsGoals.allocated} + ${t.amount}`, updatedAt: new Date() })
				.where(eq(savingsGoals.id, t.goalId));
		await audit(tx, {
			actor,
			entityType: 'goal',
			action: 'skip',
			entityId: t.goalId ?? t.id,
			entityLabel: t.goalName ?? 'Sparziel',
			before: { bookingDate: t.bookingDate, amount: t.amount }
		});
	});
	await syncInterest();
}

/**
 * Incoming transfers of goals on giro accounts for the minimum balance: the next due day of
 * each linked payment with what is set aside today. Counted before the payments of that day.
 */
export async function goalEvents(
	giroIds: string[],
	today = todayBerlin()
): Promise<Map<string, PlanEvent[]>> {
	const out = new Map<string, PlanEvent[]>();
	if (!giroIds.length) return out;
	const rows = await db
		.select({ goal: savingsGoals })
		.from(savingsGoals)
		.innerJoin(recurringItems, eq(recurringItems.id, savingsGoals.recurringId))
		.innerJoin(accounts, eq(accounts.id, savingsGoals.accountId))
		.where(
			and(
				inArray(recurringItems.accountId, giroIds),
				sql`${accounts.archivedAt} is null`,
				sql`${savingsGoals.allocated} > 0`
			)
		);
	if (!rows.length) return out;
	const goals = rows.map((r) => r.goal);
	const items = await linkedItems(
		db,
		goals.map((g) => g.recurringId!)
	);
	const done = await transferredDates(
		db,
		goals.map((g) => g.id)
	);
	for (const goal of goals) {
		const item = items.get(goal.recurringId!)!;
		const next = nextDueOf(goal, item, done.get(goal.id) ?? new Set(), today);
		if (!next || next.bookingDate <= today) continue;
		const list = out.get(item.accountId) ?? [];
		list.push({
			date: next.bookingDate,
			amount: transferAmount(goal.allocated, goal.targetAmount),
			label: purposeOf(goal.name),
			first: true
		});
		out.set(item.accountId, list);
	}
	return out;
}
