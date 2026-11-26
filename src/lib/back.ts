// The way back: a record of the pages visited in this tab, so the back button returns to
// where the user came from instead of always to the parent list.

export type TrailEntry = { path: string; title: string };
export type Trail = { entries: TrailEntry[]; index: number };

export type TrailStep =
	{ type: 'enter' } | { type: 'push' } | { type: 'replace' } | { type: 'pop'; delta: number };

/** More entries than a browser keeps are never needed. */
export const TRAIL_LIMIT = 50;

export const EMPTY_TRAIL: Trail = { entries: [], index: -1 };

const pathname = (path: string) => path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

/** The trail after a navigation that ended on `current`. */
export function advance(trail: Trail, step: TrailStep, current: TrailEntry): Trail {
	const { entries, index } = trail;
	const at = (i: number) => entries[i]?.path === current.path;
	const set = (i: number): Trail => ({
		entries: entries.map((e, n) => (n === i ? current : e)),
		index: i
	});
	const push = (): Trail => {
		const next = [...entries.slice(0, index + 1), current];
		const cut = Math.max(0, next.length - TRAIL_LIMIT);
		return { entries: next.slice(cut), index: next.length - 1 - cut };
	};

	if (step.type === 'pop') {
		const target = index + step.delta;
		if (at(target)) return set(target);
		// Out of step with the browser (e.g. after a full page load): take the nearest match.
		const near = entries
			.map((_, i) => i)
			.filter(at)
			.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
		return near === undefined ? { entries: [current], index: 0 } : set(near);
	}
	if (step.type === 'enter') {
		// Reload, or back/forward across a full page load.
		for (const i of [index, index - 1, index + 1]) if (at(i)) return set(i);
		return push();
	}
	if (step.type === 'replace' && index >= 0) return set(index);
	return push();
}

/**
 * Where the back button leads: the page visited before, unless that would not be a way back –
 * the same page with other filters, or a page below the current one (a deleted entry's page
 * after returning to its list). Null = use the fixed parent page.
 */
export function backTarget(trail: Trail): TrailEntry | null {
	const current = trail.entries[trail.index];
	const previous = trail.entries[trail.index - 1];
	if (!current || !previous) return null;
	const here = pathname(current.path);
	const there = pathname(previous.path);
	if (there === here || there.startsWith(here === '/' ? '/' : `${here}/`)) return null;
	return previous;
}

/** Path and query of a link as the trail stores them. */
export function pathOf(url: string, base: string): string {
	const target = new URL(url, base);
	return target.pathname + target.search;
}

/** Page title without the app name. */
export function plainTitle(documentTitle: string): string {
	return documentTitle.replace(/\s·\sKonto Planer$/, '').trim();
}
