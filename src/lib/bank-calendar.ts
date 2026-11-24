// Bank business days after the TARGET calendar (Eurosystem): closed on weekends, New Year's
// Day, Good Friday, Easter Monday, 1 May, 25 and 26 December. Regional holidays do not count.
import { addDays } from './recurring.js';

/** Easter Sunday (Gregorian calendar, anonymous algorithm) as "YYYY-MM-DD". */
export function easterSunday(year: number): string {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const holidayCache = new Map<number, Set<string>>();

/** TARGET holidays of a year. */
export function targetHolidays(year: number): Set<string> {
	let set = holidayCache.get(year);
	if (!set) {
		const easter = easterSunday(year);
		set = new Set([
			`${year}-01-01`,
			addDays(easter, -2),
			addDays(easter, 1),
			`${year}-05-01`,
			`${year}-12-25`,
			`${year}-12-26`
		]);
		holidayCache.set(year, set);
	}
	return set;
}

export function isBankDay(day: string): boolean {
	const [y, m, d] = day.split('-').map(Number);
	const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	if (weekday === 0 || weekday === 6) return false;
	return !targetHolidays(y).has(day);
}

/** The day itself if it is a bank day, otherwise the next one. */
export function nextBankDay(day: string): string {
	let d = day;
	while (!isBankDay(d)) d = addDays(d, 1);
	return d;
}
