// Charts of the start page: net worth history, expense ring, sparklines, rings.

/**
 * Total balance per day from `from` to `today`, reconstructed backwards from today's total and
 * the booked amounts per day. Returns [day, cents] for the first day and every day with a change.
 */
export function historySeries(
	totalToday: number,
	deltas: { date: string; amount: number }[],
	from: string,
	today: string
): [string, number][] {
	const byDay = new Map<string, number>();
	for (const d of deltas)
		if (d.date > from && d.date <= today) byDay.set(d.date, (byDay.get(d.date) ?? 0) + d.amount);
	const days = [...byDay.keys()].sort().reverse();
	const out: [string, number][] = [];
	let total = totalToday;
	if (!byDay.has(today)) out.push([today, total]);
	for (const day of days) {
		out.push([day, total]);
		total -= byDay.get(day)!;
	}
	out.push([from, total]);
	return out.reverse();
}

export type Slice = { name: string; amount: number; color: string };

/** The largest categories as slices; the rest becomes "Sonstige". */
export function donutSlices(
	categories: { name: string; amount: number; color: string }[],
	max = 6
): Slice[] {
	const sorted = categories.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
	if (sorted.length <= max) return sorted;
	const rest = sorted.slice(max - 1).reduce((s, c) => s + c.amount, 0);
	return [...sorted.slice(0, max - 1), { name: 'Sonstige', amount: rest, color: 'gray' }];
}

/** Change in whole per cent ("+12", "−8"); null without a base. */
export function changePercent(now: number, before: number): number | null {
	if (before <= 0) return null;
	return Math.round(((now - before) / before) * 100);
}

/** Balance line of a giro account up to its cut-off day: today, every step, the cut-off. */
export function sparkPoints(
	balance: number,
	steps: { date: string; balance: number }[],
	today: string,
	cutoff: string
): [string, number][] {
	const out: [string, number][] = [[today, balance]];
	for (const s of steps) {
		const last = out.at(-1)!;
		if (last[0] === s.date) last[1] = s.balance;
		else out.push([s.date, s.balance]);
	}
	if (out.at(-1)![0] !== cutoff) out.push([cutoff, out.at(-1)![1]]);
	return out;
}

/** SVG path of a step line through the points, scaled into width × height (y grows downward). */
export function sparkPath(
	points: [string, number][],
	width: number,
	height: number,
	pad = 3
): { path: string; zeroY: number | null; low: { x: number; y: number } | null } {
	if (points.length < 2) return { path: '', zeroY: null, low: null };
	const time = (d: string) => Date.parse(`${d}T00:00:00Z`);
	const t0 = time(points[0][0]);
	const t1 = time(points.at(-1)![0]);
	const values = points.map((p) => p[1]);
	const min = Math.min(...values, 0);
	const max = Math.max(...values, 0);
	const span = max - min || 1;
	const x = (d: string) => pad + ((time(d) - t0) / (t1 - t0 || 1)) * (width - 2 * pad);
	const y = (v: number) => pad + (1 - (v - min) / span) * (height - 2 * pad);
	const r = (n: number) => Math.round(n * 10) / 10;
	let path = `M${r(x(points[0][0]))} ${r(y(points[0][1]))}`;
	for (let i = 1; i < points.length; i++) path += ` H${r(x(points[i][0]))} V${r(y(points[i][1]))}`;
	let low = points[0];
	for (const p of points) if (p[1] < low[1]) low = p;
	return {
		path,
		zeroY: min < 0 ? r(y(0)) : null,
		low: low === points[0] ? null : { x: r(x(low[0])), y: r(y(low[1])) }
	};
}

/** Share for a ring (0..1) and whether the whole is exceeded. */
export function ringShare(part: number, whole: number): { share: number; over: boolean } {
	if (whole <= 0) return { share: 0, over: false };
	return { share: Math.max(0, Math.min(1, part / whole)), over: part > whole };
}
