// A recurring item without a category takes the category of its bookings.
import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookings, categories, recurringItems } from './db/schema.js';
import { audit } from './audit.js';
import { latestCategory } from '../recurring-list.js';

/**
 * Enters the category of the latest real booking (by hand or imported) at every active
 * expense or income that has none – so list, filter and the fixed-cost report know it, and
 * coming bookings get it. An item's own category is never replaced. Returns the number of
 * items changed.
 */
export async function adoptCategories(): Promise<number> {
	return db.transaction(async (tx) => {
		const rows = await tx
			.select({
				id: recurringItems.id,
				name: recurringItems.name,
				categoryId: bookings.categoryId,
				bookingDate: bookings.bookingDate,
				createdAt: bookings.createdAt
			})
			.from(recurringItems)
			.innerJoin(bookings, eq(bookings.recurringId, recurringItems.id))
			.where(
				and(
					isNull(recurringItems.categoryId),
					isNull(recurringItems.archivedAt),
					ne(recurringItems.kind, 'transfer'),
					isNotNull(bookings.categoryId),
					inArray(bookings.source, ['manual', 'import'])
				)
			);
		if (!rows.length) return 0;
		const byItem = new Map<string, typeof rows>();
		for (const r of rows) byItem.set(r.id, [...(byItem.get(r.id) ?? []), r]);
		const names = new Map(
			(await tx.select({ id: categories.id, name: categories.name }).from(categories)).map((c) => [
				c.id,
				c.name
			])
		);
		let changed = 0;
		for (const [id, own] of byItem) {
			const categoryId = latestCategory(own);
			if (!categoryId) continue;
			const [updated] = await tx
				.update(recurringItems)
				.set({ categoryId, updatedAt: new Date() })
				// Only while it still has none (someone may have chosen one meanwhile).
				.where(and(eq(recurringItems.id, id), isNull(recurringItems.categoryId)))
				.returning({ id: recurringItems.id });
			if (!updated) continue;
			// Its provisional bookings follow at once.
			await tx
				.update(bookings)
				.set({ categoryId, updatedAt: new Date() })
				.where(
					and(
						eq(bookings.recurringId, id),
						eq(bookings.source, 'provisional'),
						isNull(bookings.categoryId)
					)
				);
			await audit(tx, {
				actor: null,
				entityType: 'recurring',
				action: 'update',
				entityId: id,
				entityLabel: own[0].name,
				before: { category: null },
				after: { category: names.get(categoryId) ?? null }
			});
			changed++;
		}
		return changed;
	});
}
