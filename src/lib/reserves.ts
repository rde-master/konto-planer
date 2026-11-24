// Reserves for yearly payments ("Rücklagen"): expenses every 3 months or less often are turned
// into a monthly rate; see docs/PLAN.md "Rücklagen für Jahreszahlungen".
import { addDays, addMonths, dueDates, monthlyEquivalent, type Schedule } from './recurring.js';

/** Expenses with an interval of at least three months (quarterly, half-yearly, yearly, custom). */
export function isReserveItem(
	item: Pick<Schedule, 'interval' | 'customEvery' | 'customUnit'> & { kind: string }
): boolean {
	if (item.kind !== 'expense') return false;
	switch (item.interval) {
		case 'quarterly':
		case 'semiannual':
		case 'yearly':
			return true;
		case 'custom': {
			const every = item.customEvery ?? 1;
			if (item.customUnit === 'month') return every >= 3;
			if (item.customUnit === 'week') return every >= 13;
			return every >= 90;
		}
		default:
			return false;
	}
}

/** Amount to set aside every month for an item paid less often. */
export function reserveRate(
	amount: number,
	s: Pick<Schedule, 'interval' | 'customEvery' | 'customUnit'>
): number {
	return monthlyEquivalent(amount, s);
}

/** The schedule date before `next` (null if `next` is the first one). */
export function previousDue(s: Schedule, next: string): string | null {
	const before = dueDates(s, addMonths(next, -36), addDays(next, -1));
	return before.at(-1) ?? null;
}

/**
 * What should already be set aside today when saving evenly from the previous due date to the
 * next: amount × elapsed share of the period, rounded to cents. 0 before the first due date.
 */
export function suggestedReserve(amount: number, s: Schedule, next: string, today: string): number {
	const prev = previousDue(s, next);
	if (!prev || today <= prev) return 0;
	if (today >= next) return amount;
	const days = (a: string, b: string) =>
		(Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;
	return Math.round((amount * days(prev, today)) / days(prev, next));
}

/** First day of the next month (default start of the monthly transfer). */
export function nextMonthStart(today: string): string {
	return addMonths(`${today.slice(0, 7)}-01`, 1);
}
