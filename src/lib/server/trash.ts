import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { and, desc, eq, getTableColumns, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { db } from './db/index.js';
import {
	accounts,
	bookingParts,
	bookingTags,
	bookingTemplates,
	bookings,
	budgets,
	categories,
	categoryRules,
	contracts,
	counterpartyCategories,
	goalTransfers,
	loanExtraPayments,
	loans,
	recurringAmounts,
	recurringAttachments,
	recurringItems,
	recurringTags,
	savingsGoals,
	sharedExpenseShares,
	sharedExpenses,
	tags,
	trash,
	users,
	type TrashEntry
} from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { getAccountFor } from './accounts.js';
import { expired, TRASH_DAYS, type TrashType } from '../trash.js';

export class TrashError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Pick<typeof db, 'select'>;

/** Tables a snapshot may hold, in the order they are restored (parents first). */
const TABLES = {
	categories,
	tags,
	recurringItems,
	recurringAmounts,
	contracts,
	recurringAttachments,
	recurringTags,
	loans,
	loanExtraPayments,
	bookings,
	bookingParts,
	bookingTags,
	sharedExpenses,
	sharedExpenseShares,
	savingsGoals,
	bookingTemplates,
	categoryRules
} as const;
type TableName = keyof typeof TABLES;

/** Tables whose references are set again on restore (only where still empty). */
const LINK_TABLES = {
	budgets,
	bookings,
	recurringItems,
	bookingParts,
	categoryRules,
	bookingTemplates,
	counterpartyCategories,
	savingsGoals,
	goalTransfers,
	accounts
} as const;
type LinkTable = keyof typeof LINK_TABLES;

export type Snapshot = {
	rows: { table: TableName; rows: Record<string, unknown>[] }[];
	/** `column` = `value` on the rows with these keys, where the column is still null. */
	links: { table: LinkTable; key: string; column: string; value: string; ids: string[] }[];
	/** PDF attachments moved to the trash folder. */
	files?: string[];
};

function attachmentDir() {
	return path.resolve(
		process.env.ATTACHMENT_DIR || path.join(process.cwd(), 'data', 'attachments')
	);
}
const trashDir = () => path.join(attachmentDir(), 'trash');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Moves attachment files into the trash folder (or back). */
async function moveFiles(ids: string[], toTrash: boolean) {
	if (!ids.length) return;
	await mkdir(trashDir(), { recursive: true });
	for (const id of ids.filter((x) => UUID.test(x))) {
		const live = path.join(attachmentDir(), `${id}.pdf`);
		const gone = path.join(trashDir(), `${id}.pdf`);
		try {
			await rename(toTrash ? live : gone, toTrash ? gone : live);
		} catch {
			// A missing file is not worth failing the delete or restore for.
		}
	}
}

async function rowsOf(executor: Executor, table: PgTable, column: string, ids: string[]) {
	if (!ids.length) return [];
	const col = getTableColumns(table)[column];
	if (!col) throw new Error(`unknown column ${column}`);
	return (await executor.select().from(table).where(inArray(col, ids))) as Record<
		string,
		unknown
	>[];
}

function ids(rows: Record<string, unknown>[], key = 'id'): string[] {
	return rows.map((r) => r[key]).filter((x): x is string => typeof x === 'string');
}

// --- snapshots of the objects ---------------------------------------------------------------

export async function snapshotBooking(executor: Executor, id: string): Promise<Snapshot> {
	return {
		rows: [
			{ table: 'bookings', rows: await rowsOf(executor, bookings, 'id', [id]) },
			{ table: 'bookingParts', rows: await rowsOf(executor, bookingParts, 'bookingId', [id]) },
			{ table: 'bookingTags', rows: await rowsOf(executor, bookingTags, 'bookingId', [id]) },
			{ table: 'sharedExpenses', rows: await rowsOf(executor, sharedExpenses, 'bookingId', [id]) },
			{
				table: 'sharedExpenseShares',
				rows: await rowsOf(executor, sharedExpenseShares, 'bookingId', [id])
			}
		],
		links: []
	};
}

/** A recurring item without bookings: amounts, contract, attachments, tags, loan; links of goals and cut-off days. */
export async function snapshotRecurring(executor: Executor, id: string): Promise<Snapshot> {
	const attachments = await rowsOf(executor, recurringAttachments, 'recurringId', [id]);
	const goals = await executor
		.select({ id: savingsGoals.id })
		.from(savingsGoals)
		.where(eq(savingsGoals.recurringId, id));
	const cutoffs = await executor
		.select({ id: accounts.id })
		.from(accounts)
		.where(eq(accounts.cutoffRecurringId, id));
	return {
		rows: [
			{ table: 'recurringItems', rows: await rowsOf(executor, recurringItems, 'id', [id]) },
			{
				table: 'recurringAmounts',
				rows: await rowsOf(executor, recurringAmounts, 'recurringId', [id])
			},
			{ table: 'contracts', rows: await rowsOf(executor, contracts, 'recurringId', [id]) },
			{ table: 'recurringAttachments', rows: attachments },
			{ table: 'recurringTags', rows: await rowsOf(executor, recurringTags, 'recurringId', [id]) },
			{ table: 'loans', rows: await rowsOf(executor, loans, 'recurringId', [id]) },
			{
				table: 'loanExtraPayments',
				rows: await rowsOf(executor, loanExtraPayments, 'recurringId', [id])
			}
		],
		links: [
			{
				table: 'savingsGoals',
				key: 'id',
				column: 'recurringId',
				value: id,
				ids: goals.map((g) => g.id)
			},
			{
				table: 'accounts',
				key: 'id',
				column: 'cutoffRecurringId',
				value: id,
				ids: cutoffs.map((a) => a.id)
			}
		],
		files: ids(attachments)
	};
}

/** A category with its subcategories and everything that referred to them. */
export async function snapshotCategory(executor: Executor, id: string): Promise<Snapshot> {
	const own = await executor
		.select()
		.from(categories)
		.where(or(eq(categories.id, id), eq(categories.parentId, id)));
	// Main category first, so the subcategories find their parent.
	own.sort((a, b) => Number(a.id !== id) - Number(b.id !== id));
	const links: Snapshot['links'] = [];
	const refs: [LinkTable, PgTable, string][] = [
		['bookings', bookings, 'id'],
		['recurringItems', recurringItems, 'id'],
		['bookingParts', bookingParts, 'id'],
		['categoryRules', categoryRules, 'id'],
		['bookingTemplates', bookingTemplates, 'id'],
		['counterpartyCategories', counterpartyCategories, 'key'],
		['budgets', budgets, 'id']
	];
	for (const c of own)
		for (const [name, table, key] of refs) {
			const rows = await rowsOf(executor, table, 'categoryId', [c.id]);
			if (rows.length)
				links.push({ table: name, key, column: 'categoryId', value: c.id, ids: ids(rows, key) });
		}
	return { rows: [{ table: 'categories', rows: own }], links };
}

export async function snapshotGoal(executor: Executor, id: string): Promise<Snapshot> {
	const transfers = await executor
		.select({ id: goalTransfers.id })
		.from(goalTransfers)
		.where(eq(goalTransfers.goalId, id));
	return {
		rows: [{ table: 'savingsGoals', rows: await rowsOf(executor, savingsGoals, 'id', [id]) }],
		links: [
			{
				table: 'goalTransfers',
				key: 'id',
				column: 'goalId',
				value: id,
				ids: transfers.map((t) => t.id)
			}
		]
	};
}

export async function snapshotTemplate(executor: Executor, id: string): Promise<Snapshot> {
	return {
		rows: [
			{ table: 'bookingTemplates', rows: await rowsOf(executor, bookingTemplates, 'id', [id]) }
		],
		links: []
	};
}

export async function snapshotTag(executor: Executor, id: string): Promise<Snapshot> {
	return {
		rows: [
			{ table: 'tags', rows: await rowsOf(executor, tags, 'id', [id]) },
			{ table: 'bookingTags', rows: await rowsOf(executor, bookingTags, 'tagId', [id]) },
			{ table: 'recurringTags', rows: await rowsOf(executor, recurringTags, 'tagId', [id]) }
		],
		links: []
	};
}

export async function snapshotRule(executor: Executor, id: string): Promise<Snapshot> {
	return {
		rows: [{ table: 'categoryRules', rows: await rowsOf(executor, categoryRules, 'id', [id]) }],
		links: []
	};
}

/** Puts a snapshot into the trash (call inside the delete's transaction, before deleting). */
export async function toTrash(
	tx: Tx,
	actor: NonNullable<Actor>,
	entry: {
		type: TrashType;
		id: string;
		label: string;
		accountId?: string | null;
		snapshot: Snapshot;
	}
) {
	await tx.insert(trash).values({
		entityType: entry.type,
		entityId: entry.id,
		label: entry.label,
		accountId: entry.accountId ?? null,
		snapshot: entry.snapshot,
		deletedBy: actor.id
	});
}

/** After the delete's transaction: attachment files go to the trash folder. */
export async function trashFiles(snapshot: Snapshot) {
	await moveFiles(snapshot.files ?? [], true);
}

// --- listing, restoring, purging ------------------------------------------------------------

export type TrashItem = Pick<TrashEntry, 'id' | 'entityType' | 'label' | 'deletedAt'> & {
	deletedByName: string | null;
	canRestore: boolean;
};

async function mayRestore(viewer: Viewer, entry: TrashEntry): Promise<boolean> {
	if (viewer.role !== 'admin' && entry.deletedBy !== viewer.id) return false;
	if (!entry.accountId) return true;
	const account = await getAccountFor(viewer, entry.accountId);
	return account !== null && canEditAccount(account.level, account.archivedAt !== null);
}

/** What the viewer deleted (the admin sees everything), newest first; expired ones left out. */
export async function listTrash(viewer: Viewer): Promise<TrashItem[]> {
	const rows = await db
		.select({ entry: trash, name: users.name })
		.from(trash)
		.leftJoin(users, eq(users.id, trash.deletedBy))
		.where(viewer.role === 'admin' ? undefined : eq(trash.deletedBy, viewer.id))
		.orderBy(desc(trash.deletedAt));
	const out: TrashItem[] = [];
	for (const { entry, name } of rows) {
		if (expired(entry.deletedAt)) continue;
		out.push({
			id: entry.id,
			entityType: entry.entityType,
			label: entry.label,
			deletedAt: entry.deletedAt,
			deletedByName: name,
			canRestore: await mayRestore(viewer, entry)
		});
	}
	return out;
}

/** JSON turned timestamps into strings; back to Date for the insert. */
function revive(table: PgTable, row: Record<string, unknown>): Record<string, unknown> {
	const out = { ...row };
	for (const [key, col] of Object.entries(getTableColumns(table)))
		if (col.columnType === 'PgTimestamp' && typeof out[key] === 'string')
			out[key] = new Date(out[key]);
	return out;
}

function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23505' || err?.cause?.code === '23505';
}

function isForeignKeyViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23503' || err?.cause?.code === '23503';
}

/** Restores an entry: rows back (same ids), references set again where still empty. */
export async function restoreFromTrash(actor: NonNullable<Actor> & Viewer, id: string) {
	if (!UUID.test(id)) throw new TrashError('Eintrag nicht gefunden.');
	const [entry] = await db.select().from(trash).where(eq(trash.id, id));
	if (!entry || expired(entry.deletedAt)) throw new TrashError('Eintrag nicht gefunden.');
	if (!(await mayRestore(actor, entry)))
		throw new TrashError('Diesen Eintrag darfst du nicht wiederherstellen.');
	const snapshot = entry.snapshot as Snapshot;
	try {
		await db.transaction(async (tx) => {
			const order = Object.keys(TABLES) as TableName[];
			const groups = [...snapshot.rows].sort(
				(a, b) => order.indexOf(a.table) - order.indexOf(b.table)
			);
			for (const g of groups) {
				if (!g.rows.length) continue;
				const table = TABLES[g.table];
				// Link-type rows (tags of bookings etc.) may point to objects that are gone meanwhile.
				for (const row of g.rows) {
					try {
						await tx.execute(sql`savepoint restore_row`);
						await tx.insert(table).values(revive(table, row) as never);
						await tx.execute(sql`release savepoint restore_row`);
					} catch (e) {
						await tx.execute(sql`rollback to savepoint restore_row`);
						const optional = ['bookingTags', 'recurringTags', 'bookingParts'].includes(g.table);
						if (!optional || !isForeignKeyViolation(e)) throw e;
					}
				}
			}
			for (const l of snapshot.links) {
				if (!l.ids.length) continue;
				const table = LINK_TABLES[l.table];
				const cols = getTableColumns(table);
				const key = cols[l.key as keyof typeof cols];
				const column = cols[l.column as keyof typeof cols];
				if (!key || !column) continue;
				await tx
					.update(table)
					.set({ [l.column]: l.value })
					.where(and(inArray(key, l.ids), isNull(column)));
			}
			await tx.delete(trash).where(eq(trash.id, id));
			await audit(tx, {
				actor,
				entityType: entry.entityType === 'rule' ? 'rule' : (entry.entityType as never),
				action: 'restore',
				entityId: entry.entityId,
				entityLabel: entry.label,
				after: { fromTrash: true }
			});
		});
	} catch (e) {
		if (isUniqueViolation(e))
			throw new TrashError(
				'Es gibt inzwischen einen Eintrag mit demselben Namen. Bitte erst umbenennen.'
			);
		if (isForeignKeyViolation(e))
			throw new TrashError('Das zugehörige Konto oder ein anderer Bezug fehlt inzwischen.');
		throw e;
	}
	await moveFiles(snapshot.files ?? [], false);
	return entry;
}

/** Removes entries for good (the admin: one, or all); files in the trash folder too. */
export async function purgeTrash(actor: NonNullable<Actor> & Viewer, id?: string) {
	if (actor.role !== 'admin') throw new TrashError('Endgültig löschen darf nur der Admin.');
	const removed = await db.transaction(async (tx) => {
		const gone = await tx
			.delete(trash)
			.where(id ? eq(trash.id, id) : undefined)
			.returning();
		for (const e of gone)
			await audit(tx, {
				actor,
				entityType: e.entityType as never,
				action: 'purge',
				entityId: e.entityId,
				entityLabel: e.label
			});
		return gone;
	});
	await removeTrashedFiles(removed);
	return removed.length;
}

async function removeTrashedFiles(entries: TrashEntry[]) {
	const files = entries.flatMap((e) => (e.snapshot as Snapshot).files ?? []);
	await Promise.all(
		files
			.filter((f) => UUID.test(f))
			.map((f) => rm(path.join(trashDir(), `${f}.pdf`), { force: true }))
	);
}

/** Background job: entries older than 30 days are removed. */
export async function purgeExpired(now = new Date()) {
	const limit = new Date(now.getTime() - TRASH_DAYS * 86_400_000);
	const gone = await db.delete(trash).where(lt(trash.deletedAt, limit)).returning();
	await removeTrashedFiles(gone);
	return gone.length;
}
