import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { accounts, bookingTemplates, categories, type BookingTemplate } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { snapshotTemplate, toTrash } from './trash.js';
import { diff } from './audit-rules.js';
import type { Viewer } from './account-rules.js';
import { listAccountsFor } from './accounts.js';
import { categoryInfo } from './categories.js';
import {
	canDeleteTemplate,
	canEditTemplate,
	canUnshareTemplate,
	moveInOrder,
	type TemplateValues
} from './template-rules.js';
import { formatEuroInput } from '../money.js';

export class TemplateError extends Error {}

type Executor = Pick<typeof db, 'select'>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type TemplateSummary = BookingTemplate & {
	shared: boolean;
	/** Name of the account if the viewer may see it. */
	accountName: string | null;
	category: { name: string; color: string | null; parentName: string | null } | null;
	canEdit: boolean;
	canDelete: boolean;
};

/** Values the quick entry fills in when a template is tapped. */
export type QuickTemplate = {
	id: string;
	name: string;
	kind: string;
	/** German input format ("12,50") or empty. */
	amount: string;
	/** Only set if the user may book on the account; otherwise the last used one applies. */
	accountId: string | null;
	categoryId: string | null;
	counterparty: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_TAKEN = 'Eine Vorlage mit diesem Namen gibt es hier schon.';

function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23505' || err?.cause?.code === '23505';
}

/** Own templates first, then the shared ones; each in their own order. */
async function visibleRows(executor: Executor, viewer: Viewer) {
	return executor
		.select()
		.from(bookingTemplates)
		.where(or(eq(bookingTemplates.ownerId, viewer.id), isNull(bookingTemplates.ownerId)))
		.orderBy(
			sql`${bookingTemplates.ownerId} is null`,
			asc(bookingTemplates.position),
			asc(bookingTemplates.name)
		);
}

export async function listTemplatesFor(viewer: Viewer): Promise<TemplateSummary[]> {
	const [rows, visible, category] = await Promise.all([
		visibleRows(db, viewer),
		listAccountsFor(viewer),
		categoryInfo(db)
	]);
	const names = new Map(visible.map((a) => [a.id, a.name]));
	return rows.map((t) => ({
		...t,
		shared: t.ownerId === null,
		accountName: t.accountId ? (names.get(t.accountId) ?? null) : null,
		category: category(t.categoryId),
		canEdit: canEditTemplate(viewer, t),
		canDelete: canDeleteTemplate(viewer, t)
	}));
}

/** Templates for the quick entry; accounts the user cannot book on are left out. */
export async function quickTemplates(
	viewer: Viewer,
	bookingAccountIds: Set<string>
): Promise<QuickTemplate[]> {
	const rows = await visibleRows(db, viewer);
	return rows.map((t) => ({
		id: t.id,
		name: t.name,
		kind: t.kind,
		amount: t.amount ? formatEuroInput(t.amount) : '',
		accountId: t.accountId && bookingAccountIds.has(t.accountId) ? t.accountId : null,
		categoryId: t.categoryId,
		counterparty: t.counterparty
	}));
}

/** The template if it is the viewer's own or shared; otherwise null (callers answer 404). */
async function getVisible(executor: Executor, viewer: Viewer, id: string) {
	if (!UUID.test(id)) return null;
	const [t] = await executor
		.select()
		.from(bookingTemplates)
		.where(
			and(
				eq(bookingTemplates.id, id),
				or(eq(bookingTemplates.ownerId, viewer.id), isNull(bookingTemplates.ownerId))
			)
		);
	return t ?? null;
}

export async function getTemplateFor(viewer: Viewer, id: string) {
	return getVisible(db, viewer, id);
}

/** Audit fields: account and category by name. */
async function auditFields(
	executor: Executor,
	t: Pick<
		BookingTemplate,
		'name' | 'kind' | 'amount' | 'accountId' | 'categoryId' | 'counterparty'
	> & {
		shared: boolean;
	}
) {
	let account: string | null = null;
	if (t.accountId) {
		const [a] = await executor
			.select({ name: accounts.name })
			.from(accounts)
			.where(eq(accounts.id, t.accountId));
		account = a?.name ?? null;
	}
	let category: string | null = null;
	if (t.categoryId) {
		const [c] = await executor
			.select({ name: categories.name })
			.from(categories)
			.where(eq(categories.id, t.categoryId));
		category = c?.name ?? null;
	}
	return {
		name: t.name,
		kind: t.kind,
		amount: t.amount,
		account,
		category,
		counterparty: t.counterparty,
		shared: t.shared
	};
}

function scopeOf(ownerId: string | null) {
	return ownerId === null
		? isNull(bookingTemplates.ownerId)
		: eq(bookingTemplates.ownerId, ownerId);
}

async function nextPosition(tx: Tx, ownerId: string | null): Promise<number> {
	const [row] = await tx
		.select({ max: sql<number | null>`max(${bookingTemplates.position})` })
		.from(bookingTemplates)
		.where(scopeOf(ownerId));
	return (row?.max ?? -1) + 1;
}

function columns(values: TemplateValues) {
	return {
		name: values.name,
		kind: values.kind,
		amount: values.amount,
		accountId: values.accountId,
		categoryId: values.categoryId,
		counterparty: values.counterparty
	};
}

async function guardUnique<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (isUniqueViolation(e)) throw new TemplateError(NAME_TAKEN);
		throw e;
	}
}

/** Creates a template; values must be validated with `validateTemplate`. */
export async function createTemplate(
	actor: NonNullable<Actor> & Viewer,
	values: TemplateValues
): Promise<string> {
	const ownerId = values.shared ? null : actor.id;
	return guardUnique(() =>
		db.transaction(async (tx) => {
			const [created] = await tx
				.insert(bookingTemplates)
				.values({
					...columns(values),
					ownerId,
					position: await nextPosition(tx, ownerId),
					createdBy: actor.id
				})
				.returning({ id: bookingTemplates.id });
			await audit(tx, {
				actor,
				entityType: 'template',
				action: 'create',
				entityId: created.id,
				entityLabel: values.name,
				after: await auditFields(tx, values)
			});
			return created.id;
		})
	);
}

export async function updateTemplate(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	values: TemplateValues
) {
	await guardUnique(() =>
		db.transaction(async (tx) => {
			const current = await getVisible(tx, actor, id);
			if (!current) throw new TemplateError('Vorlage nicht gefunden.');
			if (!canEditTemplate(actor, current))
				throw new TemplateError('Du darfst diese Vorlage nicht ändern.');
			const wasShared = current.ownerId === null;
			if (wasShared && !values.shared && !canUnshareTemplate(actor))
				throw new TemplateError('Nur der Admin kann eine gemeinsame Vorlage wieder privat machen.');
			const ownerId = values.shared ? null : wasShared ? actor.id : current.ownerId;
			const position =
				ownerId === current.ownerId ? current.position : await nextPosition(tx, ownerId);
			await tx
				.update(bookingTemplates)
				.set({ ...columns(values), ownerId, position, updatedAt: new Date() })
				.where(eq(bookingTemplates.id, id));
			const changes = diff(
				await auditFields(tx, { ...current, shared: wasShared }),
				await auditFields(tx, values)
			);
			if (changes)
				await audit(tx, {
					actor,
					entityType: 'template',
					action: 'update',
					entityId: id,
					entityLabel: values.name,
					...changes
				});
		})
	);
}

export async function deleteTemplate(
	actor: NonNullable<Actor> & Viewer,
	id: string
): Promise<string> {
	return db.transaction(async (tx) => {
		const current = await getVisible(tx, actor, id);
		if (!current) throw new TemplateError('Vorlage nicht gefunden.');
		if (!canDeleteTemplate(actor, current))
			throw new TemplateError('Gemeinsame Vorlagen löscht nur der Admin.');
		await toTrash(tx, actor, {
			type: 'template',
			id,
			label: current.name,
			snapshot: await snapshotTemplate(tx, id)
		});
		await tx.delete(bookingTemplates).where(eq(bookingTemplates.id, id));
		await audit(tx, {
			actor,
			entityType: 'template',
			action: 'delete',
			entityId: id,
			entityLabel: current.name,
			before: await auditFields(tx, { ...current, shared: current.ownerId === null })
		});
		return current.name;
	});
}

/** Moves a template one step within its list (own or shared) and renumbers that list. */
export async function moveTemplate(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	direction: 'up' | 'down'
) {
	await db.transaction(async (tx) => {
		const current = await getVisible(tx, actor, id);
		if (!current) throw new TemplateError('Vorlage nicht gefunden.');
		if (!canEditTemplate(actor, current))
			throw new TemplateError('Du darfst diese Vorlage nicht ändern.');
		const list = await tx
			.select({ id: bookingTemplates.id, position: bookingTemplates.position })
			.from(bookingTemplates)
			.where(scopeOf(current.ownerId))
			.orderBy(asc(bookingTemplates.position), asc(bookingTemplates.name));
		const order = moveInOrder(
			list.map((t) => t.id),
			id,
			direction
		);
		if (!order) return;
		for (const [i, tid] of order.entries())
			await tx.update(bookingTemplates).set({ position: i }).where(eq(bookingTemplates.id, tid));
		const before = list.findIndex((t) => t.id === id) + 1;
		await audit(tx, {
			actor,
			entityType: 'template',
			action: 'update',
			entityId: id,
			entityLabel: current.name,
			before: { position: before },
			after: { position: order.indexOf(id) + 1 }
		});
	});
}
