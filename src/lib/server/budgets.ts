import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from './db/index.js';
import { accounts, budgets, categories, type Budget } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { getAccountFor, listAccountsFor } from './accounts.js';
import { reportBookings, reportCategories } from './reports.js';
import type { FieldErrors } from './validation.js';
import { budgetState, categoryFamily, spentIn, type BudgetState } from '../budgets.js';
import { monthRange } from '../reports.js';
import { formatEuro, parseEuro } from '../money.js';

export class BudgetError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BudgetRow = {
	id: string;
	categoryId: string | null;
	categoryName: string;
	color: string;
	accountId: string | null;
	accountName: string;
	limit: number;
	spent: number;
	state: BudgetState;
	canEdit: boolean;
};

/** Budgets the viewer sees (accounts they see, and their own "all accounts" budgets). */
async function visibleBudgets(viewer: Viewer) {
	const visible = await listAccountsFor(viewer);
	const ids = visible.map((a) => a.id);
	const rows = await db
		.select()
		.from(budgets)
		.where(
			or(
				ids.length ? inArray(budgets.accountId, ids) : undefined,
				and(isNull(budgets.accountId), eq(budgets.ownerId, viewer.id))
			)
		);
	return { rows, visible };
}

/** All visible budgets of a month with what was spent. */
export async function budgetsFor(viewer: Viewer, month: string): Promise<BudgetRow[]> {
	const { rows, visible } = await visibleBudgets(viewer);
	if (!rows.length) return [];
	const cats = await reportCategories();
	const byId = new Map(cats.map((c) => [c.id, c]));
	const { from, to } = monthRange(month);
	const allIds = visible.filter((a) => !a.archivedAt).map((a) => a.id);
	const bookingsOf = new Map<string, Awaited<ReturnType<typeof reportBookings>>>();
	const load = async (key: string, ids: string[]) => {
		if (!bookingsOf.has(key)) bookingsOf.set(key, await reportBookings(ids, from, to));
		return bookingsOf.get(key)!;
	};
	const out: BudgetRow[] = [];
	for (const r of rows) {
		const cat = r.categoryId ? byId.get(r.categoryId) : undefined;
		const account = r.accountId ? visible.find((a) => a.id === r.accountId) : undefined;
		const list = r.accountId ? await load(r.accountId, [r.accountId]) : await load('*', allIds);
		const spent = cat ? spentIn(categoryFamily(cat.id, cats), list) : 0;
		const parent = cat?.parentId ? byId.get(cat.parentId) : undefined;
		out.push({
			id: r.id,
			categoryId: r.categoryId,
			categoryName: cat
				? parent
					? `${parent.name} › ${cat.name}`
					: cat.name
				: 'Kategorie gelöscht',
			color: (parent ?? cat)?.color ?? 'gray',
			accountId: r.accountId,
			accountName: account?.name ?? 'Alle Konten',
			limit: r.amount,
			spent,
			state: budgetState(spent, r.amount),
			canEdit: r.accountId
				? !!account && canEditAccount(account.level, account.archivedAt !== null)
				: r.ownerId === viewer.id
		});
	}
	return out.sort(
		(a, b) =>
			b.spent / b.limit - a.spent / a.limit || a.categoryName.localeCompare(b.categoryName, 'de')
	);
}

export type BudgetInput = { categoryId: string; accountId: string; amount: string };
export type BudgetValues = { categoryId: string; accountId: string | null; amount: number };

export function validateBudget(
	input: BudgetInput,
	ctx: { categoryIds: Set<string>; accountIds: Set<string> }
): { values: BudgetValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	if (!ctx.categoryIds.has(input.categoryId)) errors.categoryId = 'Bitte eine Kategorie wählen.';
	const accountId = input.accountId || null;
	if (accountId && !ctx.accountIds.has(accountId))
		errors.accountId = 'Für dieses Konto darfst du kein Budget anlegen.';
	const amount = parseEuro(input.amount);
	if (amount === null || amount <= 0) errors.amount = 'Bitte einen Betrag größer 0 eingeben.';
	if (Object.keys(errors).length || amount === null) return { values: null, errors };
	return { values: { categoryId: input.categoryId, accountId, amount }, errors: null };
}

/** Accounts the viewer may set budgets for (edit right, active). */
export async function budgetAccounts(viewer: Viewer) {
	return (await listAccountsFor(viewer)).filter((a) =>
		canEditAccount(a.level, a.archivedAt !== null)
	);
}

function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23505' || err?.cause?.code === '23505';
}

async function label(
	executor: typeof db,
	v: { categoryId: string | null; accountId: string | null }
) {
	const [cat] = v.categoryId
		? await executor
				.select({ name: categories.name })
				.from(categories)
				.where(eq(categories.id, v.categoryId))
		: [];
	const [acc] = v.accountId
		? await executor
				.select({ name: accounts.name })
				.from(accounts)
				.where(eq(accounts.id, v.accountId))
		: [];
	return `${cat?.name ?? 'Kategorie'} · ${acc?.name ?? 'Alle Konten'}`;
}

export async function saveBudget(
	actor: NonNullable<Actor> & Viewer,
	id: string | null,
	values: BudgetValues
) {
	if (values.accountId) {
		const account = await getAccountFor(actor, values.accountId);
		if (!account || !canEditAccount(account.level, account.archivedAt !== null))
			throw new BudgetError('Für dieses Konto darfst du kein Budget anlegen.');
	}
	let current: Budget | undefined;
	if (id) {
		current = await requireEditable(actor, id);
	}
	try {
		await db.transaction(async (tx) => {
			const row = {
				categoryId: values.categoryId,
				accountId: values.accountId,
				ownerId: values.accountId ? null : actor.id,
				amount: values.amount
			};
			const name = await label(db, row);
			if (current) {
				await tx
					.update(budgets)
					.set({ ...row, updatedAt: new Date() })
					.where(eq(budgets.id, current.id));
				await audit(tx, {
					actor,
					entityType: 'budget',
					action: 'update',
					entityId: current.id,
					entityLabel: name,
					before: { budgetFor: await label(db, current), amount: current.amount },
					after: { budgetFor: name, amount: values.amount }
				});
			} else {
				const [created] = await tx
					.insert(budgets)
					.values({ ...row, createdBy: actor.id })
					.returning();
				await audit(tx, {
					actor,
					entityType: 'budget',
					action: 'create',
					entityId: created.id,
					entityLabel: name,
					after: { budgetFor: name, amount: values.amount }
				});
			}
		});
	} catch (e) {
		if (isUniqueViolation(e))
			throw new BudgetError('Für diese Kategorie und dieses Konto gibt es schon ein Budget.');
		throw e;
	}
}

async function requireEditable(viewer: Viewer, id: string): Promise<Budget> {
	if (!UUID.test(id)) throw new BudgetError('Budget nicht gefunden.');
	const [row] = await db.select().from(budgets).where(eq(budgets.id, id));
	if (!row) throw new BudgetError('Budget nicht gefunden.');
	if (row.accountId) {
		const account = await getAccountFor(viewer, row.accountId);
		if (!account) throw new BudgetError('Budget nicht gefunden.');
		if (!canEditAccount(account.level, account.archivedAt !== null))
			throw new BudgetError('Dieses Budget darfst du nicht ändern.');
	} else if (row.ownerId !== viewer.id) throw new BudgetError('Budget nicht gefunden.');
	return row;
}

export async function deleteBudget(actor: NonNullable<Actor> & Viewer, id: string) {
	const row = await requireEditable(actor, id);
	await db.transaction(async (tx) => {
		await tx.delete(budgets).where(eq(budgets.id, id));
		await audit(tx, {
			actor,
			entityType: 'budget',
			action: 'delete',
			entityId: id,
			entityLabel: await label(db, row),
			before: { amount: row.amount }
		});
	});
}

/**
 * Hint after a booking ("Lebensmittel: noch 120,00 € diesen Monat"), for budgets of the
 * booking's category on its account or on all accounts. Null without a budget.
 */
export async function budgetHint(
	viewer: Viewer,
	categoryId: string | null,
	accountId: string,
	month: string
): Promise<string | null> {
	if (!categoryId) return null;
	const cats = await reportCategories();
	const cat = cats.find((c) => c.id === categoryId);
	if (!cat) return null;
	// The booking's category, or its main category.
	const keys = new Set([cat.id, ...(cat.parentId ? [cat.parentId] : [])]);
	const rows = (await budgetsFor(viewer, month)).filter(
		(b) =>
			b.categoryId && keys.has(b.categoryId) && (b.accountId === accountId || b.accountId === null)
	);
	if (!rows.length) return null;
	return rows
		.map((b) =>
			b.spent > b.limit
				? `${b.categoryName}: Budget um ${formatEuro(b.spent - b.limit)} überschritten`
				: `${b.categoryName}: noch ${formatEuro(b.limit - b.spent)} diesen Monat`
		)
		.join(' · ');
}
