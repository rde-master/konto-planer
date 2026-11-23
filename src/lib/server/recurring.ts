import { and, asc, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
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
/** `level` null: the viewer cannot see the account; only its name is shown. */
type AccountInfo = Pick<AccountWithLevel, 'id' | 'name' | 'color' | 'type' | 'archivedAt'> & {
	level: AccessLevel | null;
};

export type RecurringSummary = RecurringItem & {
	/** Source account (for transfers the paying one). */
	account: AccountInfo;
	/** Receiving account of a transfer. */
	targetAccount: AccountInfo | null;
	category: { name: string; color: string | null; parentName: string | null } | null;
	amount: number | null;
	nextDue: string | null;
	canEdit: boolean;
	canManage: boolean;
};

export type RecurringDetail = RecurringSummary & {
	amounts: RecurringAmount[];
	createdByName: string | null;
};

function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23505' || err?.cause?.code === '23505';
}

/**
 * May archive, restore and delete: edit right on the non-archived source account. A transfer's
 * creator keeps this right even without edit access (plan: creator and admin).
 */
function itemManageable(
	viewer: Viewer,
	account: AccountInfo,
	item: Pick<RecurringItem, 'kind' | 'createdBy'>
) {
	if (account.archivedAt !== null) return false;
	if (account.level && canEditAccount(account.level, false)) return true;
	return item.kind === 'transfer' && item.createdBy === viewer.id;
}

/** Editable: manageable and the item itself not archived. */
function itemEditable(
	viewer: Viewer,
	account: AccountInfo,
	item: Pick<RecurringItem, 'kind' | 'createdBy' | 'archivedAt'>
) {
	return item.archivedAt === null && itemManageable(viewer, account, item);
}

/** Accounts by id with the viewer's level; accounts the viewer cannot see get level null. */
async function accountInfos(visible: AccountWithLevel[], ids: string[]) {
	const byId = new Map<string, AccountInfo>(visible.map((a) => [a.id, a]));
	const missing = [...new Set(ids)].filter((id) => !byId.has(id));
	if (missing.length) {
		const rows = await db
			.select({
				id: accounts.id,
				name: accounts.name,
				color: accounts.color,
				type: accounts.type,
				archivedAt: accounts.archivedAt
			})
			.from(accounts)
			.where(inArray(accounts.id, missing));
		// Only the name of a foreign account is shown.
		for (const a of rows) byId.set(a.id, { ...a, color: 'gray', level: null });
	}
	return byId;
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

/**
 * All recurring items on accounts the viewer may see, with current amount and next due date.
 * Transfers also appear for viewers of the target account only.
 */
export async function listRecurringFor(viewer: Viewer): Promise<RecurringSummary[]> {
	const visible = await listAccountsFor(viewer);
	if (!visible.length) return [];
	const visibleIds = visible.map((a) => a.id);
	const items = await db
		.select()
		.from(recurringItems)
		.where(
			or(
				inArray(recurringItems.accountId, visibleIds),
				inArray(recurringItems.targetAccountId, visibleIds)
			)
		)
		.orderBy(asc(recurringItems.name));
	if (!items.length) return [];
	const accountById = await accountInfos(
		visible,
		items.flatMap((i) => [i.accountId, i.targetAccountId ?? i.accountId])
	);
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
			targetAccount: item.targetAccountId ? accountById.get(item.targetAccountId)! : null,
			category: category(item.categoryId),
			amount: amountOn(
				amounts.filter((a) => a.recurringId === item.id),
				today
			),
			nextDue: item.archivedAt ? null : nextDue(item, today),
			canEdit: itemEditable(viewer, account, item),
			canManage: itemManageable(viewer, account, item)
		};
	});
}

/**
 * The item if the viewer may see its account (for transfers: source or target account),
 * otherwise null (callers answer 404).
 */
export async function getRecurringFor(viewer: Viewer, id: string): Promise<RecurringDetail | null> {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
	const [item] = await db.select().from(recurringItems).where(eq(recurringItems.id, id));
	if (!item) return null;
	const [source, target] = await Promise.all([
		getAccountFor(viewer, item.accountId),
		item.targetAccountId ? getAccountFor(viewer, item.targetAccountId) : null
	]);
	if (!source && !target) return null;
	const byId = await accountInfos(
		[source, target].filter((a) => a !== null),
		[item.accountId, item.targetAccountId ?? item.accountId]
	);
	const account = byId.get(item.accountId)!;
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
		targetAccount: item.targetAccountId ? byId.get(item.targetAccountId)! : null,
		category: category(item.categoryId),
		amount: amountOn(amounts, today),
		nextDue: item.archivedAt ? null : nextDue(item, today),
		canEdit: itemEditable(viewer, account, item),
		canManage: itemManageable(viewer, account, item),
		amounts,
		createdByName
	};
}

/**
 * Accounts the user may add recurring items to: edit right, not archived. Income and expenses
 * only on giro accounts (`type`), transfers also from savings accounts.
 */
export async function accountsForNewItems(viewer: Viewer) {
	const all = await listAccountsFor(viewer);
	return all.filter((a) => canEditAccount(a.level, a.archivedAt !== null));
}

/** Possible transfer targets: every active account of the app, shown by name only. */
export async function transferTargets(): Promise<{ id: string; name: string }[]> {
	return db
		.select({ id: accounts.id, name: accounts.name })
		.from(accounts)
		.where(isNull(accounts.archivedAt))
		.orderBy(asc(accounts.name));
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
async function accountName(executor: Executor, id: string | null) {
	if (!id) return null;
	const [a] = await executor
		.select({ name: accounts.name })
		.from(accounts)
		.where(eq(accounts.id, id));
	return a?.name ?? null;
}

async function auditFields(executor: Executor, v: RecurringValues) {
	let category: string | null = null;
	if (v.categoryId) {
		const [c] = await executor
			.select({ name: categories.name })
			.from(categories)
			.where(eq(categories.id, v.categoryId));
		category = c?.name ?? null;
	}
	return {
		account: await accountName(executor, v.accountId),
		kind: v.kind,
		targetAccount: await accountName(executor, v.targetAccountId),
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
		targetAccountId: item.targetAccountId,
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

async function requireEditableAccount(viewer: Viewer, values: RecurringValues) {
	const account = await getAccountFor(viewer, values.accountId);
	if (
		!account ||
		(values.kind !== 'transfer' && account.type !== 'giro') ||
		!canEditAccount(account.level, account.archivedAt !== null)
	)
		throw new RecurringError('Auf diesem Konto darfst du keine Dauerposten anlegen.');
	return account;
}

/** The target must exist and be active; the viewer needs no access to it. */
async function requireTarget(executor: Executor, values: RecurringValues, currentTarget?: string) {
	if (values.kind !== 'transfer') return;
	if (!values.targetAccountId || values.targetAccountId === values.accountId)
		throw new RecurringError('Bitte ein anderes Zielkonto wählen.');
	if (values.targetAccountId === currentTarget) return;
	const [target] = await executor
		.select({ archivedAt: accounts.archivedAt })
		.from(accounts)
		.where(eq(accounts.id, values.targetAccountId));
	if (!target || target.archivedAt) throw new RecurringError('Bitte ein Zielkonto wählen.');
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
	await requireEditableAccount(actor, values);
	await requireTarget(db, values);
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
	if (values.kind !== current.kind && (values.kind === 'transfer' || current.kind === 'transfer'))
		throw new RecurringError('Eine Umbuchung bleibt eine Umbuchung.');
	if (values.accountId !== current.accountId) await requireEditableAccount(actor, values);
	else if (values.kind !== 'transfer' && current.account.type !== 'giro')
		throw new RecurringError('Auf diesem Konto darfst du keine Dauerposten anlegen.');
	await requireTarget(db, values, current.targetAccountId ?? undefined);
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
	if (!item.canManage) throw new RecurringError('Du darfst diesen Dauerposten nicht bearbeiten.');
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
	if (!item.canManage) throw new RecurringError('Du darfst diesen Dauerposten nicht bearbeiten.');
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
