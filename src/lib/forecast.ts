// 12-month forecast of an account's balance ("12-Monats-Vorschau").
import type { PlanEvent } from './minimum.js';

export type Forecast = {
	/** Balance after each day with events, starting with today: [day, cents]. */
	series: [string, number][];
	/** Lowest balance after today (null without events). */
	lowest: { date: string; balance: number } | null;
	/** Balance on the last day. */
	end: number;
};

/**
 * Walks the events after today up to and including `until`, day by day (on one day the
 * outgoing payments first, so the lowest point is not hidden by income later that day).
 */
export function forecast(
	balance: number,
	events: PlanEvent[],
	today: string,
	until: string
): Forecast {
	const relevant = events
		.filter((e) => e.date > today && e.date <= until && e.amount !== 0)
		.sort(
			(a, b) =>
				a.date.localeCompare(b.date) ||
				Number(!a.first) - Number(!b.first) ||
				Number(a.amount > 0) - Number(b.amount > 0)
		);
	const series: [string, number][] = [[today, balance]];
	let running = balance;
	let lowest: Forecast['lowest'] = null;
	for (const e of relevant) {
		running += e.amount;
		if (!lowest || running < lowest.balance) lowest = { date: e.date, balance: running };
		const last = series.at(-1)!;
		if (last[0] === e.date) last[1] = running;
		else series.push([e.date, running]);
	}
	if (series.at(-1)![0] !== until) series.push([until, running]);
	return { series, lowest, end: running };
}
