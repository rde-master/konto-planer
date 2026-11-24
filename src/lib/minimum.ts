// Minimum balance ("Mindestbestand") up to the cut-off day ("Stichtag"); see docs/PLAN.md.
import { addDays, addMonths } from './recurring.js';

export const CUTOFF_MODES = ['salary', 'month_end', 'date'] as const;
export type CutoffMode = (typeof CUTOFF_MODES)[number];

export const CUTOFF_MODE_LABELS: Record<CutoffMode, string> = {
	salary: 'Nächster Gehaltseingang',
	month_end: 'Monatsende',
	date: 'Festes Datum'
};

/** Last day of the month of `day`. */
export function monthEnd(day: string): string {
	return addDays(addMonths(`${day.slice(0, 7)}-01`, 1), -1);
}

export type Cutoff = {
	date: string;
	/** The mode actually used (salary or a free date may fall back to the month end). */
	mode: CutoffMode;
	/** Why the chosen mode could not be used. */
	fallback: 'no_salary' | 'date_passed' | null;
};

/**
 * The cut-off day. Month end: end of this month, or of next month on the last day.
 * Salary: the next bank day of the salary income after today. A free date must lie after today.
 */
export function resolveCutoff(
	mode: CutoffMode,
	today: string,
	opts: { nextSalary?: string | null; date?: string | null }
): Cutoff {
	const end = monthEnd(today) > today ? monthEnd(today) : monthEnd(addDays(today, 1));
	if (mode === 'salary') {
		if (opts.nextSalary && opts.nextSalary > today)
			return { date: opts.nextSalary, mode, fallback: null };
		return { date: end, mode: 'month_end', fallback: 'no_salary' };
	}
	if (mode === 'date') {
		if (opts.date && opts.date > today) return { date: opts.date, mode, fallback: null };
		return { date: end, mode: 'month_end', fallback: 'date_passed' };
	}
	return { date: end, mode, fallback: null };
}

export type PlanEvent = {
	date: string;
	amount: number;
	label: string;
	/** Counted before the payments of its day (transfers of savings goals for that payment). */
	first?: boolean;
};

export type MinimumPlan = {
	/** Amount that must be on the account today (>= 0): deepest drop plus buffer. */
	minimum: number;
	/** Safety amount of the account, part of the minimum. */
	buffer: number;
	/** Balance minus minimum; negative = money is missing. */
	available: number;
	/** Lowest projected balance and its day (null if nothing happens until the cut-off). */
	lowest: { date: string; balance: number } | null;
	/** Dispo hints: in use today, falls below 0, exceeds the overdraft limit. */
	overdraftInUse: boolean;
	goesNegative: boolean;
	exceedsOverdraft: boolean;
	/** Events in the order they are counted, with the balance after each. */
	steps: (PlanEvent & { balance: number })[];
};

/**
 * Walks the events after today up to and including the cut-off day; on each day outgoing
 * payments first, then incoming ones (cautious), except events marked `first`. The minimum is the deepest drop below today
 * plus the account's buffer.
 */
export function minimumPlan(
	balance: number,
	overdraftLimit: number,
	events: PlanEvent[],
	cutoff: string,
	today: string,
	buffer = 0
): MinimumPlan {
	const relevant = events
		.filter((e) => e.date > today && e.date <= cutoff && e.amount !== 0)
		.sort(
			(a, b) =>
				a.date.localeCompare(b.date) ||
				Number(!a.first) - Number(!b.first) ||
				Number(a.amount > 0) - Number(b.amount > 0) ||
				a.label.localeCompare(b.label, 'de')
		);
	let running = balance;
	let lowest: MinimumPlan['lowest'] = null;
	const steps: MinimumPlan['steps'] = [];
	for (const e of relevant) {
		running += e.amount;
		steps.push({ ...e, balance: running });
		if (!lowest || running < lowest.balance) lowest = { date: e.date, balance: running };
	}
	const drop = lowest ? Math.max(0, balance - lowest.balance) : 0;
	const projectedLow = Math.min(balance, lowest?.balance ?? balance);
	return {
		minimum: drop + buffer,
		buffer,
		available: balance - drop - buffer,
		lowest,
		overdraftInUse: balance < 0,
		goesNegative: projectedLow < 0 && (lowest?.balance ?? 0) < 0 && balance >= 0,
		exceedsOverdraft: projectedLow < -overdraftLimit,
		steps
	};
}
