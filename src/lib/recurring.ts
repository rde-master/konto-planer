// Client-safe logic for recurring items: intervals, due dates and amount history.
// Calendar dates are "YYYY-MM-DD" strings; amounts are positive integer cents.

export const RECURRING_KINDS = ['expense', 'income'] as const;
export type RecurringKind = (typeof RECURRING_KINDS)[number];

export const INTERVALS = [
	'monthly',
	'quarterly',
	'semiannual',
	'yearly',
	'weekly',
	'custom',
	'once'
] as const;
export type Interval = (typeof INTERVALS)[number];

export const CUSTOM_UNITS = ['day', 'week', 'month'] as const;
export type CustomUnit = (typeof CUSTOM_UNITS)[number];

export const PAYMENT_METHODS = ['direct_debit', 'standing_order', 'manual'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const KIND_LABELS: Record<RecurringKind, string> = {
	expense: 'Ausgabe',
	income: 'Einnahme'
};

export const INTERVAL_LABELS: Record<Interval, string> = {
	weekly: 'wöchentlich',
	monthly: 'monatlich',
	quarterly: 'vierteljährlich',
	semiannual: 'halbjährlich',
	yearly: 'jährlich',
	custom: 'frei',
	once: 'einmalig'
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
	direct_debit: 'Lastschrift',
	standing_order: 'Dauerauftrag',
	manual: 'Manuelle Überweisung'
};

const UNIT_LABELS: Record<CustomUnit, [string, string]> = {
	day: ['Tag', 'Tage'],
	week: ['Woche', 'Wochen'],
	month: ['Monat', 'Monate']
};

export type Schedule = {
	interval: Interval;
	customEvery: number | null;
	customUnit: CustomUnit | null;
	startDate: string;
	endDate: string | null;
};

/** "monatlich", "alle 2 Monate", "jede Woche" … */
export function intervalLabel(s: Pick<Schedule, 'interval' | 'customEvery' | 'customUnit'>) {
	if (s.interval !== 'custom') return INTERVAL_LABELS[s.interval];
	const every = s.customEvery ?? 1;
	const unit = s.customUnit ?? 'month';
	if (every === 1) return unit === 'week' ? 'jede Woche' : `jeden ${UNIT_LABELS[unit][0]}`;
	return `alle ${every} ${UNIT_LABELS[unit][1]}`;
}

// --- calendar arithmetic on "YYYY-MM-DD" -------------------------------------------------

function parts(day: string): [number, number, number] {
	const [y, m, d] = day.split('-').map(Number);
	return [y, m, d];
}

function fmt(y: number, m: number, d: number): string {
	return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
	return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(day: string, n: number): string {
	const [y, m, d] = parts(day);
	const t = new Date(Date.UTC(y, m - 1, d + n));
	return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Adds months; a day that does not exist in the target month becomes its last day. */
export function addMonths(day: string, n: number): string {
	const [y, m, d] = parts(day);
	const index = y * 12 + (m - 1) + n;
	const ty = Math.floor(index / 12);
	const tm = (index % 12) + 1;
	return fmt(ty, tm, Math.min(d, daysInMonth(ty, tm)));
}

/** Step of the schedule as [unit, count]; null for one-off items. */
function step(s: Schedule): ['day' | 'month', number] | null {
	switch (s.interval) {
		case 'weekly':
			return ['day', 7];
		case 'monthly':
			return ['month', 1];
		case 'quarterly':
			return ['month', 3];
		case 'semiannual':
			return ['month', 6];
		case 'yearly':
			return ['month', 12];
		case 'custom': {
			const every = Math.max(1, s.customEvery ?? 1);
			if (s.customUnit === 'day') return ['day', every];
			if (s.customUnit === 'week') return ['day', every * 7];
			return ['month', every];
		}
		case 'once':
			return null;
	}
}

/** The k-th due date (k = 0 is the start). Always computed from the start, so month ends do not drift. */
function nth(s: Schedule, k: number): string {
	const st = step(s);
	if (!st) return s.startDate;
	return st[0] === 'day' ? addDays(s.startDate, st[1] * k) : addMonths(s.startDate, st[1] * k);
}

/** All due dates in [from, to] (inclusive), before bank-day shifting. */
export function dueDates(s: Schedule, from: string, to: string, limit = 1000): string[] {
	const last = s.endDate && s.endDate < to ? s.endDate : to;
	const out: string[] = [];
	const st = step(s);
	if (!st) {
		if (s.startDate >= from && s.startDate <= last) out.push(s.startDate);
		return out;
	}
	// Jump close to `from` instead of iterating from the start.
	let k = 0;
	if (from > s.startDate) {
		const [fy, fm, fd] = parts(from);
		const [sy, sm, sd] = parts(s.startDate);
		const approx =
			st[0] === 'month'
				? ((fy - sy) * 12 + (fm - sm)) / st[1]
				: (Date.UTC(fy, fm - 1, fd) - Date.UTC(sy, sm - 1, sd)) / 86_400_000 / st[1];
		k = Math.max(0, Math.floor(approx) - 1);
	}
	for (; out.length < limit; k++) {
		const date = nth(s, k);
		if (date > last) break;
		if (date >= from) out.push(date);
	}
	return out;
}

/** Next due date on or after `today`, or null if the item has ended. */
export function nextDue(s: Schedule, today: string): string | null {
	return dueDates(s, today, '9999-12-31', 1)[0] ?? null;
}

// --- amounts -----------------------------------------------------------------------------

export type AmountEntry = { amount: number; validFrom: string };

/** Amount valid on `day`: the latest entry starting on or before it (the earliest before all). */
export function amountOn(entries: AmountEntry[], day: string): number | null {
	if (!entries.length) return null;
	const sorted = [...entries].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
	let current = sorted[0];
	for (const e of sorted) if (e.validFrom <= day) current = e;
	return current.amount;
}

/** Average amount per month (rounded to cents); 0 for one-off items. */
export function monthlyEquivalent(
	amount: number,
	s: Pick<Schedule, 'interval' | 'customEvery' | 'customUnit'>
): number {
	const perYear: Record<Exclude<Interval, 'custom' | 'once'>, number> = {
		weekly: 52,
		monthly: 12,
		quarterly: 4,
		semiannual: 2,
		yearly: 1
	};
	if (s.interval === 'once') return 0;
	let times: number;
	if (s.interval === 'custom') {
		const every = Math.max(1, s.customEvery ?? 1);
		times =
			s.customUnit === 'day' ? 365 / every : s.customUnit === 'week' ? 52 / every : 12 / every;
	} else times = perYear[s.interval];
	return Math.round((amount * times) / 12);
}

/** Signed amount: expenses negative, income positive. */
export function signed(kind: RecurringKind, amount: number): number {
	return kind === 'expense' ? -amount : amount;
}
