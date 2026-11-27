import { and, asc, eq, inArray, isNull, max } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookings, categoryRules, type CategoryRule } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { diff } from './audit-rules.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { listAccountsFor } from './accounts.js';
import { categoryInfo } from './categories.js';
import { moveInOrder } from './template-rules.js';
import type { RuleValues } from './rule-rules.js';
import { categoryByRules, ruleLabel, type Rule } from '../rules.js';
import { snapshotRule, toTrash } from './trash.js';

export class RuleError extends Error {}

type Executor = Pick<typeof db, 'select'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RuleSummary = CategoryRule & {
	category: { name: string; color: string | null; parentName: string | null } | null;
};

/** All rules in their order (they are global). */
export async function listRules(): Promise<RuleSummary[]> {
	const [rows, category] = await Promise.all([
		db
			.select()
			.from(categoryRules)
			.orderBy(asc(categoryRules.position), asc(categoryRules.createdAt)),
		categoryInfo(db)
	]);
	return rows.map((r) => ({ ...r, category: category(r.categoryId) }));
}

/** Rules for matching, in order. */
export async function activeRules(executor: Executor = db): Promise<Rule[]> {
	return executor
		.select({
			field: categoryRules.field,
			operator: categoryRules.operator,
			value: categoryRules.value,
			moreConditions: categoryRules.moreConditions,
			categoryId: categoryRules.categoryId
		})
		.from(categoryRules)
		.orderBy(asc(categoryRules.position), asc(categoryRules.createdAt));
}

async function categoryName(executor: Executor, id: string | null) {
	if (!id) return null;
	const category = await categoryInfo(executor);
	const c = category(id);
	return c ? (c.parentName ? `${c.parentName} › ${c.name}` : c.name) : null;
}

async function auditFields(
	executor: Executor,
	v: Pick<CategoryRule, 'field' | 'operator' | 'value' | 'categoryId'> & {
		moreConditions?: CategoryRule['moreConditions'];
	}
) {
	return { rule: ruleLabel(v), category: await categoryName(executor, v.categoryId) };
}

export async function createRule(actor: NonNullable<Actor>, values: RuleValues): Promise<string> {
	return db.transaction(async (tx) => {
		const [last] = await tx.select({ p: max(categoryRules.position) }).from(categoryRules);
		const [created] = await tx
			.insert(categoryRules)
			.values({ ...values, position: (last?.p ?? -1) + 1, createdBy: actor.id })
			.returning();
		await audit(tx, {
			actor,
			entityType: 'rule',
			action: 'create',
			entityId: created.id,
			entityLabel: ruleLabel(created),
			after: await auditFields(tx, created)
		});
		return created.id;
	});
}

async function getRule(executor: Executor, id: string) {
	if (!UUID.test(id)) return null;
	const [row] = await executor.select().from(categoryRules).where(eq(categoryRules.id, id));
	return row ?? null;
}

export async function updateRule(actor: NonNullable<Actor>, id: string, values: RuleValues) {
	await db.transaction(async (tx) => {
		const current = await getRule(tx, id);
		if (!current) throw new RuleError('Regel nicht gefunden.');
		await tx
			.update(categoryRules)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(categoryRules.id, id));
		const changes = diff(await auditFields(tx, current), await auditFields(tx, values));
		if (changes)
			await audit(tx, {
				actor,
				entityType: 'rule',
				action: 'update',
				entityId: id,
				entityLabel: ruleLabel(values),
				...changes
			});
	});
}

/** Like categories: only the admin deletes. */
export async function deleteRule(actor: NonNullable<Actor> & Viewer, id: string) {
	if (actor.role !== 'admin') throw new RuleError('Regeln löschen darf nur der Admin.');
	await db.transaction(async (tx) => {
		const current = await getRule(tx, id);
		if (!current) throw new RuleError('Regel nicht gefunden.');
		await toTrash(tx, actor, {
			type: 'rule',
			id,
			label: ruleLabel(current),
			snapshot: await snapshotRule(tx, id)
		});
		await tx.delete(categoryRules).where(eq(categoryRules.id, id));
		await audit(tx, {
			actor,
			entityType: 'rule',
			action: 'delete',
			entityId: id,
			entityLabel: ruleLabel(current),
			before: await auditFields(tx, current)
		});
	});
}

export async function moveRule(actor: NonNullable<Actor>, id: string, direction: 'up' | 'down') {
	await db.transaction(async (tx) => {
		const current = await getRule(tx, id);
		if (!current) throw new RuleError('Regel nicht gefunden.');
		const list = await tx
			.select({ id: categoryRules.id })
			.from(categoryRules)
			.orderBy(asc(categoryRules.position), asc(categoryRules.createdAt));
		const order = moveInOrder(
			list.map((r) => r.id),
			id,
			direction
		);
		if (!order) return;
		for (const [i, rid] of order.entries())
			await tx.update(categoryRules).set({ position: i }).where(eq(categoryRules.id, rid));
		await audit(tx, {
			actor,
			entityType: 'rule',
			action: 'update',
			entityId: id,
			entityLabel: ruleLabel(current),
			before: { position: list.findIndex((r) => r.id === id) + 1 },
			after: { position: order.indexOf(id) + 1 }
		});
	});
}

/** Imported bookings without category and recurring item on accounts the user may edit. */
async function uncategorized(viewer: Viewer) {
	const editable = (await listAccountsFor(viewer))
		.filter((a) => canEditAccount(a.level, a.archivedAt !== null))
		.map((a) => a.id);
	if (!editable.length) return [];
	return db
		.select({
			id: bookings.id,
			counterparty: bookings.counterparty,
			purpose: bookings.purpose,
			iban: bookings.iban,
			bookingText: bookings.bookingText,
			bankCategory: bookings.bankCategory
		})
		.from(bookings)
		.where(
			and(
				inArray(bookings.accountId, editable),
				eq(bookings.source, 'import'),
				isNull(bookings.categoryId),
				isNull(bookings.recurringId)
			)
		);
}

/** How many uncategorised imported bookings the rules would categorise. */
export async function applicableCount(viewer: Viewer): Promise<number> {
	const rules = await activeRules();
	if (!rules.length) return 0;
	return (await uncategorized(viewer)).filter((b) => categoryByRules(rules, b) !== null).length;
}

/** "Auf bisherige Buchungen anwenden": categorises uncategorised imported bookings. */
export async function applyRules(actor: NonNullable<Actor> & Viewer): Promise<number> {
	const rules = await activeRules();
	const targets = (await uncategorized(actor))
		.map((b) => ({ id: b.id, categoryId: categoryByRules(rules, b) }))
		.filter((t): t is { id: string; categoryId: string } => t.categoryId !== null);
	if (!targets.length) return 0;
	await db.transaction(async (tx) => {
		for (const t of targets)
			await tx
				.update(bookings)
				.set({ categoryId: t.categoryId, updatedAt: new Date() })
				.where(and(eq(bookings.id, t.id), isNull(bookings.categoryId)));
		await audit(tx, {
			actor,
			entityType: 'rule',
			action: 'apply',
			entityId: null,
			entityLabel: 'Kategorie-Regeln',
			after: { bookingsCategorized: targets.length }
		});
	});
	return targets.length;
}
