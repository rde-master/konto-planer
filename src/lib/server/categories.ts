import { asc, eq, or } from 'drizzle-orm';
import { db } from './db/index.js';
import { categories, type Category } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { diff } from './audit-rules.js';
import { DEFAULT_CATEGORIES, type CategoryValues } from './category-rules.js';

export class CategoryError extends Error {}

function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23505' || err?.cause?.code === '23505';
}

const NAME_TAKEN = 'Diesen Namen gibt es hier schon.';

type Executor = Pick<typeof db, 'select'>;

/** Audit fields; the parent is logged by name so the entry stays readable. */
async function auditFields(executor: Executor, c: Pick<Category, 'name' | 'parentId' | 'color'>) {
	let parent: string | null = null;
	if (c.parentId) {
		const [row] = await executor
			.select({ name: categories.name })
			.from(categories)
			.where(eq(categories.id, c.parentId));
		parent = row?.name ?? null;
	}
	return { name: c.name, parent, color: c.color };
}

export function listCategories(): Promise<Category[]> {
	return db.select().from(categories).orderBy(asc(categories.name));
}

export async function createCategory(
	actor: NonNullable<Actor>,
	values: CategoryValues
): Promise<string> {
	try {
		return await db.transaction(async (tx) => {
			const [created] = await tx.insert(categories).values(values).returning();
			await audit(tx, {
				actor,
				entityType: 'category',
				action: 'create',
				entityId: created.id,
				entityLabel: created.name,
				after: await auditFields(tx, created)
			});
			return created.id;
		});
	} catch (e) {
		if (isUniqueViolation(e)) throw new CategoryError(NAME_TAKEN);
		throw e;
	}
}

export async function updateCategory(
	actor: NonNullable<Actor>,
	id: string,
	values: CategoryValues
) {
	try {
		await db.transaction(async (tx) => {
			const [current] = await tx.select().from(categories).where(eq(categories.id, id));
			if (!current) throw new CategoryError('Kategorie nicht gefunden.');
			await tx
				.update(categories)
				.set({ ...values, updatedAt: new Date() })
				.where(eq(categories.id, id));
			const changes = diff(await auditFields(tx, current), await auditFields(tx, values));
			if (changes) {
				await audit(tx, {
					actor,
					entityType: 'category',
					action: 'update',
					entityId: id,
					entityLabel: values.name,
					...changes
				});
			}
		});
	} catch (e) {
		if (isUniqueViolation(e)) throw new CategoryError(NAME_TAKEN);
		throw e;
	}
}

/**
 * Deletes a category and (for main categories) its subcategories; every deleted
 * category gets its own log entry. Bookings keep existing and become uncategorised
 * (their foreign key uses ON DELETE SET NULL).
 */
export async function deleteCategory(actor: NonNullable<Actor>, id: string): Promise<string> {
	return db.transaction(async (tx) => {
		const affected = await tx
			.select()
			.from(categories)
			.where(or(eq(categories.id, id), eq(categories.parentId, id)));
		const target = affected.find((c) => c.id === id);
		if (!target) throw new CategoryError('Kategorie nicht gefunden.');
		const parentName = target.parentId ? (await auditFields(tx, target)).parent : null;
		// Children first, so their log entries still name the parent.
		for (const c of [...affected.filter((c) => c.id !== id), target]) {
			await audit(tx, {
				actor,
				entityType: 'category',
				action: 'delete',
				entityId: c.id,
				entityLabel: c.name,
				before: { name: c.name, parent: c.id === id ? parentName : target.name, color: c.color }
			});
		}
		await tx.delete(categories).where(eq(categories.id, id));
		return target.name;
	});
}

/** Creates the suggested categories; only while there are none yet. Returns the count. */
export async function createDefaultCategories(actor: NonNullable<Actor>): Promise<number> {
	return db.transaction(async (tx) => {
		const [any] = await tx.select({ id: categories.id }).from(categories).limit(1);
		if (any) throw new CategoryError('Es gibt schon Kategorien.');
		let count = 0;
		for (const main of DEFAULT_CATEGORIES) {
			const [created] = await tx
				.insert(categories)
				.values({ name: main.name, color: main.color })
				.returning();
			const subs = main.children.length
				? await tx
						.insert(categories)
						.values(main.children.map((name) => ({ name, parentId: created.id })))
						.returning()
				: [];
			for (const c of [created, ...subs]) {
				await audit(tx, {
					actor,
					entityType: 'category',
					action: 'create',
					entityId: c.id,
					entityLabel: c.name,
					after: { name: c.name, parent: c.parentId ? created.name : null, color: c.color }
				});
			}
			count += 1 + subs.length;
		}
		return count;
	});
}
