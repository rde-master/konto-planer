// Savings interest: day-exact (act/365, 366 in leap years) on the end-of-day balance, credited at
// the end of each period. Rates are stored in thousandths of a percent (2,75 % = 2750).
import { addDays, addMonths } from './recurring.js';
import { monthEnd } from './minimum.js';

export const INTEREST_RHYTHMS = ['monthly', 'quarterly', 'yearly'] as const;
export type InterestRhythm = (typeof INTEREST_RHYTHMS)[number];

export const INTEREST_RHYTHM_LABELS: Record<InterestRhythm, string> = {
	monthly: 'monatlich',
	quarterly: 'vierteljährlich',
	yearly: 'jährlich'
};

export type RateEntry = { rate: number; validFrom: string };

/** "2,75 %" from 2750. */
export function formatRate(rate: number): string {
	return `${(rate / 1000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} %`;
}

/** Parses "2,75" or "2.75" (percent) into thousandths; null if invalid or not in 0..100. */
export function parseRate(input: string): number | null {
	const s = input.replace(/\s|%/g, '').replace(',', '.');
	if (!/^\d{1,3}(\.\d{1,3})?$/.test(s)) return null;
	const value = Math.round(Number(s) * 1000);
	return value <= 100_000 ? value : null;
}

/** Rate valid on `day` (0 before the first entry). */
export function rateOn(rates: RateEntry[], day: string): number {
	let current: RateEntry | undefined;
	for (const r of rates)
		if (r.validFrom <= day && (!current || r.validFrom >= current.validFrom)) current = r;
	return current?.rate ?? 0;
}

/** Last day of the interest period containing `day`. */
export function periodEnd(rhythm: InterestRhythm, day: string): string {
	if (rhythm === 'monthly') return monthEnd(day);
	if (rhythm === 'yearly') return `${day.slice(0, 4)}-12-31`;
	const month = Number(day.slice(5, 7));
	const lastMonth = Math.ceil(month / 3) * 3;
	return monthEnd(`${day.slice(0, 4)}-${String(lastMonth).padStart(2, '0')}-01`);
}

function daysInYear(day: string): number {
	const y = Number(day.slice(0, 4));
	return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
}

export type BalanceEvent = { date: string; amount: number };

export type Credit = { periodEnd: string; amount: number };

/**
 * Interest per period from `start` (opening date) to `until` (inclusive). `events` change the
 * balance at the end of their day; each credit is added on its period end (compounding).
 * `fixed` overrides the computed amount of a period (set by hand or skipped = 0).
 * Returns the credits of all periods ending on or before `until`, plus the interest accrued
 * in the running period (unrounded cents, for the forecast).
 */
export function computeInterest(opts: {
	openingBalance: number;
	start: string;
	until: string;
	rhythm: InterestRhythm;
	rates: RateEntry[];
	events: BalanceEvent[];
	fixed?: Map<string, number>;
}): { credits: Credit[]; accrued: number; balance: number } {
	const byDay = new Map<string, number>();
	for (const e of opts.events)
		if (e.date >= opts.start) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.amount);
	const rates = [...opts.rates].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
	let balance = opts.openingBalance;
	let accrued = 0;
	const credits: Credit[] = [];
	for (let day = opts.start; day <= opts.until; day = addDays(day, 1)) {
		balance += byDay.get(day) ?? 0;
		const rate = rateOn(rates, day);
		if (rate > 0 && balance > 0) accrued += (balance * rate) / 100_000 / daysInYear(day);
		if (day === periodEnd(opts.rhythm, day)) {
			const amount = opts.fixed?.get(day) ?? Math.round(accrued);
			if (amount !== 0) credits.push({ periodEnd: day, amount });
			balance += amount;
			accrued = 0;
		}
	}
	return { credits, accrued, balance };
}

/** Start of the period that ends on `end`. */
export function periodStart(rhythm: InterestRhythm, end: string): string {
	const months = rhythm === 'monthly' ? 1 : rhythm === 'quarterly' ? 3 : 12;
	return addDays(monthEnd(addMonths(`${end.slice(0, 7)}-01`, -months)), 1);
}
