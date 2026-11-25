// Monthly budgets per category: what was spent against the limit.
import type { CategoryNode, ReportBooking } from './reports.js';
import { categoryShares } from './splits.js';

/** The category and its subcategories. */
export function categoryFamily(categoryId: string, categories: CategoryNode[]): Set<string> {
	return new Set([
		categoryId,
		...categories.filter((c) => c.parentId === categoryId).map((c) => c.id)
	]);
}

/**
 * Spent in a category (with subcategories) by the bookings: expenses count, refunds reduce;
 * split bookings by their parts, internal transfers not at all. Never below 0.
 */
export function spentIn(family: Set<string>, bookings: ReportBooking[]): number {
	let spent = 0;
	for (const b of bookings) {
		if (b.internal) continue;
		for (const s of categoryShares(b, b.parts))
			if (s.categoryId && family.has(s.categoryId)) spent -= s.amount;
	}
	return Math.max(0, spent);
}

export type BudgetState = 'ok' | 'warn' | 'over';

/** "warn" from 80 % on, "over" above 100 %. */
export function budgetState(spent: number, limit: number): BudgetState {
	if (spent > limit) return 'over';
	if (spent >= limit * 0.8) return 'warn';
	return 'ok';
}

/** Share of the month that has passed (day of month ÷ days), for the pace line. */
export function monthProgress(today: string, month: string): number {
	if (today.slice(0, 7) > month) return 1;
	if (today.slice(0, 7) < month) return 0;
	const [y, m, d] = today.split('-').map(Number) as [number, number, number];
	const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return d / days;
}
