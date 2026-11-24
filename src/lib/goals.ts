// Savings goals ("Sparziele"); see docs/PLAN.md "Sparziel".
import { duesBetween, type ExpectedDue } from './due.js';
import { addMonths, type AmountEntry, type Schedule } from './recurring.js';

/**
 * Number of monthly savings left until `target`: whole months from `today`, at least 1.
 * Example: from 24.11. to 15.06. there are 6 monthly savings (Dec. to May).
 */
export function monthsUntil(today: string, target: string): number {
	const [y1, m1, d1] = today.split('-').map(Number) as [number, number, number];
	const [y2, m2, d2] = target.split('-').map(Number) as [number, number, number];
	const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
	return Math.max(1, months);
}

/**
 * Amount to set aside per month to reach the goal on time (rounded up to whole cents).
 * Null without a date or when the date has passed; 0 when the goal is reached.
 */
export function savingRate(
	target: number,
	allocated: number,
	today: string,
	date: string | null
): number | null {
	const missing = Math.max(0, target - allocated);
	if (missing === 0) return 0;
	if (!date || date < today) return null;
	return Math.ceil(missing / monthsUntil(today, date));
}

/** Share reached, 0..1. */
export function progress(target: number, allocated: number): number {
	if (target <= 0) return 1;
	return Math.min(1, Math.max(0, allocated / target));
}

/** Transferred to the giro account on the due day: what was set aside, at most the target. */
export function transferAmount(allocated: number, target: number): number {
	return Math.max(0, Math.min(allocated, target));
}

/** Part of the balance not set aside for any goal (negative = more set aside than there is). */
export function freeAmount(balance: number, allocations: number[]): number {
	return allocations.reduce((rest, a) => rest - a, balance);
}

/**
 * Next due item of the linked payment from `from` on that has no transfer yet; null if the
 * payment has no more due dates (a one-off payment that has been paid: the goal is done).
 */
export function nextGoalDue(
	item: Schedule,
	amounts: AmountEntry[],
	from: string,
	transferred: Set<string>
): ExpectedDue | null {
	return (
		duesBetween(item, amounts, from, addMonths(from, 60)).find(
			(d) => !transferred.has(d.dueDate)
		) ?? null
	);
}
