import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from './db/index.js';
import {
	accounts,
	categories,
	recurringAmounts,
	recurringItems,
	users,
	type RecurringAmount,
	type RecurringItem
} from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { diff } from './audit-rules.js';
import { canEditAccount, type AccessLevel, type Viewer } from './account-rules.js';
import { getAccountFor, listAccountsFor, type AccountWithLevel } from './accounts.js';
import type { RecurringValues } from './recurring-rules.js';
import { amountOn, intervalLabel, nextDue } from '../recurring.js';
import { todayBerlin } from '../dates.js';

export class RecurringError extends Error {}

type Executor = Pick<typeof db, 'select'>;
type AccountInfo = Pick<AccountWithLevel, 'id' | 'name' | 'color' | 'type' | 'archivedAt'> & {
	level: AccessLevel;
};

export type RecurringSummary = RecurringItem & {
	account: AccountInfo;
	category: { name: string; color: string | null; parentName: string | null } | null;
	amount: number | null;
	nextDue: string | null;
	canEdit: boolean;
};

export type RecurringDetail = RecurringSummary & {
	amounts: RecurringAmount[];
	createdByName: string | null;
};

function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23505' || err?.cause?.code === '23505';
}

/** Editable: edit right on a non-archived account and the item itself not archived. */
function itemEditable(account: AccountInfo, item: Pick<RecurringItem, 'archivedAt'>) {
	return canEditAccount(account.level, account.archivedAt !== null) && item.archivedAt === null;
}

async function categoryInfo(executor: Executor) {
	const rows = await executor.select().from(categories);
	const byId = new Map(rows.map((c) => [c.id, c]));
	return (id: string | null) => {
		const c = id ? byId.get(id) : undefined;
		if (!c) return null;
		const parent = c.parentId ? byId.get(c.parentId) : undefined;
		return {
			name: c.name,
			color: parent ? parent.color : c.color,
			parentName: parent?.name ?? null
		};
	};
}

/** All recurring items on accounts the viewer may see, with current amount and next due date. */
export async function listRecurringFor(viewer: Viewer): Promise<RecurringSummary[]> {
	const visible = await listAccountsFor(viewer);
	if (!visible.length) return [];
	const accountById = new Map(visible.map((a) => [a.id, a]));
	const items = await db
		.select()
		.from(recurringItems)
		.where(
			inArray(
				recurringItems.accountId,
				visible.map((a) => a.id)
			)
		)
		.orderBy(asc(recurringItems.name));
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
	const category = await categoryInfo(db);
	const today = todayBerlin();
	return items.map((item) => {
		const account = accountById.get(item.accountId)!;
		return {
			...item,
			account,
			category: category(item.categoryId),
			amount: amountOn(
				amounts.filter((a) => a.recurringId === item.id),
				today
			),
			nextDue: item.archivedAt ? null : nextDue(item, today),
			canEdit: itemEditable(account, item)
		};
	});
}

/** The item if the viewer may see its account, otherwise null (callers answer 404). */
export async function getRecurringFor(viewer: Viewer, id: string): Promise<RecurringDetail | null> {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
	const [item] = await db.select().from(recurringItems).where(eq(recurringItems.id, id));
	if (!item) return null;
	const account = await getAccountFor(viewer, item.accountId);
	if (!account) return null;
	const amounts = await db
		.select()
		.from(recurringAmounts)
		.where(eq(recurringAmounts.recurringId, id))
		.orderBy(desc(recurringAmounts.validFrom));
	let createdByName: string | null = null;
	if (item.createdBy) {
		const [u] = await db
			.select({ name: users.name })
			.from(users)
			.where(eq(users.id, item.createdBy));
		createdByName = u?.name ?? null;
	}
	const category = await categoryInfo(db);
	const today = todayBerlin();
	return {
		...item,
		account,
		category: category(item.categoryId),
		amount: amountOn(amounts, today),
		nextDue: item.archivedAt ? null : nextDue(item, today),
		canEdit: itemEditable(account, item),
		amounts,
		createdByName
	};
}

/** Accounts the user may add recurring items to: giro, edit right, not archived. */
export async function accountsForNewItems(viewer: Viewer) {
	const all = await listAccountsFor(viewer);
	return all.filter((a) => a.type === 'giro' && canEditAccount(a.level, a.archivedAt !== null));
}

/**
 * Whether bookings reference the item. Items with bookings are archived instead of deleted.
 * Extend when bookings arrive (0.14).
 */
export function recurringHasData(recurringId: string): Promise<boolean> {
	void recurringId;
	return Promise.resolve(false);
}

/** Audit view of an item: references by name, interval as text. */
async function auditFields(executor: Executor, v: RecurringValues) {
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
		kind: v.kind,
		name: v.name,
		counterparty: v.counterparty,
		iban: v.iban,
		mandateReference: v.mandateReference,
		creditorId: v.creditorId,
		category,
		interval: intervalLabel(v),
		startDate: v.startDate,
		endDate: v.endDate,
		variable: v.variable,
		isSalary: v.isSalary,
		paymentMethod: v.paymentMethod
	};
}

function valuesOf(item: RecurringItem): RecurringValues {
	return {
		accountId: item.accountId,
		kind: item.kind,
		name: item.name,
		counterparty: item.counterparty,
		iban: item.iban,
		mandateReference: item.mandateReference,
		creditorId: item.creditorId,
		categoryId: item.categoryId,
		interval: item.interval,
		customEvery: item.customEvery,
		customUnit: item.customUnit,
		startDate: item.startDate,
		endDate: item.endDate,
		variable: item.variable,
		isSalary: item.isSalary,
		paymentMethod: item.paymentMethod
	};
}

async function requireEditableAccount(viewer: Viewer, accountId: string) {
	const account = await getAccountFor(viewer, accountId);
	if (
		!account ||
		account.type !== 'giro' ||
		!canEditAccount(account.level, account.archivedAt !== null)
	)
		throw new RecurringError('Auf diesem Konto darfst du keine Dauerposten anlegen.');
	return account;
}

async function requireEditable(viewer: Viewer, id: string) {
	const item = await getRecurringFor(viewer, id);
	if (!item) throw new RecurringError('Dauerposten nicht gefunden.');
	if (!item.canEdit) throw new RecurringError('Du darfst diesen Dauerposten nicht bearbeiten.');
	return item;
}

export async function createRecurring(
	actor: NonNullable<Actor> & Viewer,
	values: RecurringValues,
	amount: number
): Promise<string> {
	await requireEditableAccount(actor, values.accountId);
	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(recurringItems)
			.values({ ...values, createdBy: actor.id })
			.returning();
		await tx
			.insert(recurringAmounts)
			.values({ recurringId: created.id, amount, validFrom: values.startDate });
		await audit(tx, {
			actor,
			entityType: 'recurring',
			action: 'create',
			entityId: created.id,
			entityLabel: created.name,
			after: { ...(await auditFields(tx, values)), amount }
		});
		return created.id;
	});
}

export async function updateRecurring(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	values: RecurringValues
) {
	const current = await requireEditable(actor, id);
	if (values.accountId !== current.accountId) await requireEditableAccount(actor, values.accountId);
	await db.transaction(async (tx) => {
		await tx
			.update(recurringItems)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(recurringItems.id, id));
		const changes = diff(await auditFields(tx, valuesOf(current)), await auditFields(tx, values));
		if (changes) {
			await audit(tx, {
				actor,
				entityType: 'recurring',
				action: 'update',
				entityId: id,
				entityLabel: values.name,
				...changes
			});
		}
	});
}

export async function setRecurringArchived(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	archived: boolean
) {
	const item = await getRecurringFor(actor, id);
	if (!item) throw new RecurringError('Dauerposten nicht gefunden.');
	if (!canEditAccount(item.account.level, item.account.archivedAt !== null))
		throw new RecurringError('Du darfst diesen Dauerposten nicht bearbeiten.');
	await db.transaction(async (tx) => {
		await tx
			.update(recurringItems)
			.set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
			.where(eq(recurringItems.id, id));
		await audit(tx, {
			actor,
			entityType: 'recurring',
			action: archived ? 'archive' : 'restore',
			entityId: id,
			entityLabel: item.name
		});
	});
}

export async function deleteRecurring(actor: NonNullable<Actor> & Viewer, id: string) {
	const item = await getRecurringFor(actor, id);
	if (!item) throw new RecurringError('Dauerposten nicht gefunden.');
	if (!canEditAccount(item.account.level, item.account.archivedAt !== null))
		throw new RecurringError('Du darfst diesen Dauerposten nicht bearbeiten.');
	if (await recurringHasData(id))
		throw new RecurringError('Der Dauerposten hat Buchungen und kann nur archiviert werden.');
	await db.transaction(async (tx) => {
		const before = await auditFields(tx, valuesOf(item));
		await tx.delete(recurringItems).where(eq(recurringItems.id, id));
		await audit(tx, {
			actor,
			entityType: 'recurring',
			action: 'delete',
			entityId: id,
			entityLabel: item.name,
			before: { ...before, amount: item.amount }
		});
	});
}

const DATE_TAKEN = 'Für dieses Datum gibt es schon einen Betrag.';

/** Adds an amount valid from a date (past or future). */
export async function addAmount(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	entry: { amount: number; validFrom: string }
) {
	const item = await requireEditable(actor, id);
	try {
		await db.transaction(async (tx) => {
			await tx.insert(recurringAmounts).values({ recurringId: id, ...entry });
			await audit(tx, {
				actor,
				entityType: 'recurring',
				action: 'amount_change',
				entityId: id,
				entityLabel: item.name,
				before: null,
				after: entry
			});
		});
	} catch (e) {
		if (isUniqueViolation(e)) throw new RecurringError(DATE_TAKEN);
		throw e;
	}
}

export async function updateAmount(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	amountId: string,
	entry: { amount: number; validFrom: string }
) {
	const item = await requireEditable(actor, id);
	const current = item.amounts.find((a) => a.id === amountId);
	if (!current) throw new RecurringError('Betrag nicht gefunden.');
	try {
		await db.transaction(async (tx) => {
			await tx.update(recurringAmounts).set(entry).where(eq(recurringAmounts.id, amountId));
			const changes = diff({ amount: current.amount, validFrom: current.validFrom }, entry);
			if (changes) {
				await audit(tx, {
					actor,
					entityType: 'recurring',
					action: 'amount_change',
					entityId: id,
					entityLabel: item.name,
					...changes
				});
			}
		});
	} catch (e) {
		if (isUniqueViolation(e)) throw new RecurringError(DATE_TAKEN);
		throw e;
	}
}

export async function deleteAmount(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	amountId: string
) {
	const item = await requireEditable(actor, id);
	const current = item.amounts.find((a) => a.id === amountId);
	if (!current) throw new RecurringError('Betrag nicht gefunden.');
	await db.transaction(async (tx) => {
		const others = await tx
			.select({ id: recurringAmounts.id })
			.from(recurringAmounts)
			.where(and(eq(recurringAmounts.recurringId, id), ne(recurringAmounts.id, amountId)));
		if (!others.length) throw new RecurringError('Der letzte Betrag kann nicht gelöscht werden.');
		await tx.delete(recurringAmounts).where(eq(recurringAmounts.id, amountId));
		await audit(tx, {
			actor,
			entityType: 'recurring',
			action: 'amount_change',
			entityId: id,
			entityLabel: item.name,
			before: { amount: current.amount, validFrom: current.validFrom },
			after: null
		});
	});
}
