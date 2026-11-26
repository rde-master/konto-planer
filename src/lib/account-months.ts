// "Monatsübersicht" on the account page: what came in and what went out per month.
import { monthName } from './monthly-report.js';
import { addDays, addMonths } from './recurring.js';

/** Sums of one month as the database delivers them (signed cents). */
export type MonthSums = {
	/** "2026-11" */
	month: string;
	/** Everything that arrived (≥ 0). */
	incoming: number;
	/** Everything that left the account (≤ 0): payments, transfers, card statements. */
	outgoing: number;
	/** Part of `outgoing` that went to other accounts of the app. */
	transfersOut: number;
	/** Part of `incoming` that came from other accounts of the app. */
	transfersIn: number;
	/** Number of bookings that left the account. */
	outCount: number;
};

export type MonthSummary = MonthSums & {
	/** "November 2026" */
	label: string;
	/** First and last day of the month. */
	from: string;
	to: string;
	/** incoming + outgoing */
	net: number;
	/** The running month: sums up to today. */
	current: boolean;
};

/** First and last day of a month ("2026-02" → 1st and 28th). */
export function monthBounds(month: string): { from: string; to: string } {
	const from = `${month}-01`;
	return { from, to: addDays(addMonths(from, 1), -1) };
}

/**
 * The last `count` months up to today, newest first, each with its sums (zero without
 * bookings). Months before the account's opening date are left out: its bookings do not count.
 */
export function monthSummaries(
	rows: MonthSums[],
	today: string,
	openingDate: string,
	count = 12
): MonthSummary[] {
	const byMonth = new Map(rows.map((r) => [r.month, r]));
	const thisMonth = today.slice(0, 7);
	const firstMonth = openingDate.slice(0, 7);
	const out: MonthSummary[] = [];
	for (let i = 0; i < count; i++) {
		const month = addMonths(`${thisMonth}-01`, -i).slice(0, 7);
		if (month < firstMonth) break;
		const sums = byMonth.get(month) ?? {
			month,
			incoming: 0,
			outgoing: 0,
			transfersOut: 0,
			transfersIn: 0,
			outCount: 0
		};
		out.push({
			...sums,
			label: monthName(month),
			...monthBounds(month),
			net: sums.incoming + sums.outgoing,
			current: month === thisMonth
		});
	}
	return out;
}

/** First day the sums start at: the opening date or the first of the oldest month shown. */
export function monthsSince(today: string, openingDate: string, count = 12): string {
	const oldest = addMonths(`${today.slice(0, 7)}-01`, -(count - 1));
	return openingDate > oldest ? openingDate : oldest;
}
