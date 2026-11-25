// Savings suggestion on payday ("Sparvorschlag am Gehaltstag"): once the salary is booked, the
// freely available amount of the giro account, rounded down to 10 €, can go to a savings account.
import type { DueStatus } from './due.js';

/** Suggestions are rounded down to this step (cents) and start at it. */
export const SUGGESTION_STEP = 1000;

export function suggestedSaving(available: number): number {
	if (available < SUGGESTION_STEP) return 0;
	return Math.floor(available / SUGGESTION_STEP) * SUGGESTION_STEP;
}

export type SalaryDue = { dueDate: string; bookingDate: string; status: DueStatus };

/** The latest salary booked (provisionally or for real) on or before today. */
export function lastSalary(dues: SalaryDue[], today: string): SalaryDue | null {
	let best: SalaryDue | null = null;
	for (const d of dues)
		if (
			d.status !== 'skipped' &&
			d.bookingDate <= today &&
			(!best || d.bookingDate > best.bookingDate)
		)
			best = d;
	return best;
}

/** How much of a transfer can be allocated to a goal (never above its target). */
export function goalShare(
	amount: number,
	goal: { allocated: number; targetAmount: number }
): number {
	return Math.max(0, Math.min(amount, goal.targetAmount - goal.allocated));
}
