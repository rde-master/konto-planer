// Client-safe contract logic: notice periods, renewals and the next possible termination.
// Calendar dates are "YYYY-MM-DD" strings.
import { addDays, addMonths, type CustomUnit } from './recurring.js';

export const RENEWALS = ['indefinite', 'period', 'none'] as const;
export type Renewal = (typeof RENEWALS)[number];

export const RENEWAL_LABELS: Record<Renewal, string> = {
	indefinite: 'Unbefristet',
	period: 'Um feste Zeit',
	none: 'Keine'
};

/** Default lead time before the notice deadline when nothing is set in the settings. */
export const DEFAULT_LEAD_DAYS = 30;

export type Contract = {
	/** End of the (initial) minimum term; null only for indefinite contracts without one. */
	termEnd: string | null;
	noticeEvery: number;
	noticeUnit: CustomUnit;
	renewal: Renewal;
	/** Only for renewal "period". */
	renewalMonths: number | null;
	/** Reminder lead in days; null = default from the settings. */
	leadDays: number | null;
	cancelledOn: string | null;
};

const UNIT_LABELS: Record<CustomUnit, [string, string]> = {
	day: ['Tag', 'Tage'],
	week: ['Woche', 'Wochen'],
	month: ['Monat', 'Monate']
};

export function periodLabel(every: number, unit: CustomUnit): string {
	if (every === 0) return 'ohne Frist';
	return `${every} ${UNIT_LABELS[unit][every === 1 ? 0 : 1]}`;
}

/** "Verlängerung um 12 Monate", "unbefristet" … */
export function renewalLabel(c: Pick<Contract, 'renewal' | 'renewalMonths'>): string {
	if (c.renewal === 'period') return `um ${periodLabel(c.renewalMonths ?? 12, 'month')}`;
	return c.renewal === 'indefinite' ? 'unbefristet' : 'keine';
}

function shift(day: string, every: number, unit: CustomUnit, sign: 1 | -1): string {
	if (unit === 'month') return addMonths(day, sign * every);
	return addDays(day, sign * every * (unit === 'week' ? 7 : 1));
}

/** Last day a cancellation must arrive for the contract to end on `end`. */
export function noticeDeadline(c: Pick<Contract, 'noticeEvery' | 'noticeUnit'>, end: string) {
	return shift(end, c.noticeEvery, c.noticeUnit, -1);
}

/**
 * Earliest end of the contract when cancelling on `day`. Renewal periods are counted from
 * the original term end, so month ends do not drift.
 */
export function terminationEnd(c: Contract, day: string): string {
	if (c.renewal === 'none' && c.termEnd) return c.termEnd;
	if (c.termEnd && noticeDeadline(c, c.termEnd) >= day) return c.termEnd;
	if (c.renewal === 'period' && c.termEnd) {
		const months = Math.max(1, c.renewalMonths ?? 12);
		for (let k = 1; k < 10_000; k++) {
			const end = addMonths(c.termEnd, k * months);
			if (noticeDeadline(c, end) >= day) return end;
		}
	}
	// Indefinite (or the term is over): the notice period runs from the cancellation.
	return shift(day, c.noticeEvery, c.noticeUnit, 1);
}

export type ContractStatus =
	/** Cancelled; ends on `end`. */
	| { state: 'cancelled'; end: string }
	/** No renewal; ends on `end` without cancellation. */
	| { state: 'ends'; end: string }
	/** Running: cancel by `deadline` to end on `end`. */
	| { state: 'fixed'; end: string; deadline: string }
	/** Indefinite after the minimum term: cancel any day, ends after the notice period. */
	| { state: 'anytime'; end: string };

export function contractStatus(c: Contract, today: string): ContractStatus {
	if (c.cancelledOn) return { state: 'cancelled', end: terminationEnd(c, c.cancelledOn) };
	if (c.renewal === 'none' && c.termEnd) return { state: 'ends', end: c.termEnd };
	const end = terminationEnd(c, today);
	if (c.termEnd && (c.renewal === 'period' || end === c.termEnd))
		return { state: 'fixed', end, deadline: noticeDeadline(c, end) };
	return { state: 'anytime', end };
}

/** Day from which the contract counts as "bald kündbar" (deadline minus lead), or null. */
export function reminderDay(c: Contract, today: string, defaultLead: number): string | null {
	const status = contractStatus(c, today);
	if (status.state !== 'fixed') return null;
	return addDays(status.deadline, -(c.leadDays ?? defaultLead));
}

/** Whether the notice deadline is within the lead time. */
export function cancelSoon(c: Contract, today: string, defaultLead: number): boolean {
	const day = reminderDay(c, today, defaultLead);
	return day !== null && today >= day;
}

/**
 * End date of the recurring item after saving contract data: a new cancellation date sets
 * the computed contract end; a contract without renewal ends at its term end. Otherwise the
 * entered end date stays (it can be changed by hand afterwards).
 */
export function endDateAfterSave(
	endDate: string | null,
	next: Contract | null,
	previous: Contract | null
): string | null {
	if (!next) return endDate;
	if (next.cancelledOn && next.cancelledOn !== previous?.cancelledOn)
		return terminationEnd(next, next.cancelledOn);
	const termChanged =
		!previous || previous.termEnd !== next.termEnd || previous.renewal !== next.renewal;
	if (!next.cancelledOn && next.renewal === 'none' && next.termEnd && termChanged)
		return next.termEnd;
	return endDate;
}
