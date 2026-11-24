// Client-safe logic for planned amount changes: future "gültig ab" entries of recurring items.
// Amounts are integer cents, calendar dates "YYYY-MM-DD" strings.
import { formatEuro } from './money.js';
import { monthlyEquivalent, type AmountEntry, type Schedule } from './recurring.js';

export type AmountChange = {
	validFrom: string;
	/** Amount valid before the change. */
	previous: number;
	amount: number;
	/** amount − previous. */
	diff: number;
	/** Change in percent with one decimal; null when the previous amount was 0. */
	percent: number | null;
};

/** Difference and percentage between two amounts (cents). */
export function changeDelta(previous: number, amount: number) {
	const diff = amount - previous;
	const percent = previous === 0 ? null : Math.round((diff * 1000) / previous) / 10;
	return { diff, percent };
}

/**
 * Changes taking effect after `today`, oldest first. Changes after the end of the item are
 * left out, since no due date uses them.
 */
export function plannedChanges(
	entries: AmountEntry[],
	today: string,
	endDate: string | null = null
): AmountChange[] {
	const sorted = [...entries].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
	const changes: AmountChange[] = [];
	for (let i = 1; i < sorted.length; i++) {
		const { validFrom, amount } = sorted[i];
		if (validFrom <= today || (endDate !== null && validFrom > endDate)) continue;
		const previous = sorted[i - 1].amount;
		changes.push({ validFrom, previous, amount, ...changeDelta(previous, amount) });
	}
	return changes;
}

/** Amount valid right before `day` (entries starting earlier), or null if there is none. */
export function amountBefore(entries: AmountEntry[], day: string): number | null {
	let best: AmountEntry | null = null;
	for (const e of entries)
		if (e.validFrom < day && (!best || e.validFrom > best.validFrom)) best = e;
	return best?.amount ?? null;
}

export type PlannedEntry = {
	amounts: AmountEntry[];
	endDate: string | null;
	schedule: Pick<Schedule, 'interval' | 'customEvery' | 'customUnit'>;
	/** −1 for money leaving the account, +1 for money arriving. */
	sign: 1 | -1;
};

export type MonthlyStep = {
	from: string;
	/** Monthly totals from this day on (positive cents). */
	expense: number;
	income: number;
	/** Change against the totals before this day. */
	expenseDiff: number;
	incomeDiff: number;
};

/**
 * How planned changes move the monthly totals of a group, starting from the current totals.
 * Only amount changes count; items ending in between are not subtracted.
 */
export function monthlySteps(
	entries: PlannedEntry[],
	today: string,
	current: { expense: number; income: number }
): MonthlyStep[] {
	const byDay = new Map<string, { expense: number; income: number }>();
	for (const e of entries) {
		for (const c of plannedChanges(e.amounts, today, e.endDate)) {
			const diff =
				monthlyEquivalent(c.amount, e.schedule) - monthlyEquivalent(c.previous, e.schedule);
			if (diff === 0) continue;
			const step = byDay.get(c.validFrom) ?? { expense: 0, income: 0 };
			if (e.sign < 0) step.expense += diff;
			else step.income += diff;
			byDay.set(c.validFrom, step);
		}
	}
	let { expense, income } = current;
	return [...byDay.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([from, d]) => {
			expense += d.expense;
			income += d.income;
			return { from, expense, income, expenseDiff: d.expense, incomeDiff: d.income };
		});
}

/** "+5,00 €", "−2,50 €", "±0,00 €". */
export function formatDiff(cents: number): string {
	if (cents === 0) return `±${formatEuro(0)}`;
	return cents > 0 ? `+${formatEuro(cents)}` : formatEuro(cents);
}

const percentFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/** "+16,7 %", "−5 %". */
export function formatPercent(percent: number): string {
	const text = percentFormat.format(Math.abs(percent));
	return `${percent > 0 ? '+' : percent < 0 ? '−' : '±'}${text} %`;
}
