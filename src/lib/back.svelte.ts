import { goto } from '$app/navigation';
import { EMPTY_TRAIL, advance, backTarget, pathOf, type Trail, type TrailStep } from './back.js';

// State of the way back for this tab; kept across reloads in the session storage.
const KEY = 'kp:trail';

let trail: Trail = $state(EMPTY_TRAIL);
/** User the trail belongs to: after another login in the same tab it starts anew. */
let owner = '';
/** Target of a `goto` that replaces the current page (the router does not tell afterwards). */
let replaceTarget: string | null = null;

function load(): Trail {
	try {
		const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as
			(Trail & { owner?: string }) | null;
		if (
			raw &&
			raw.owner === owner &&
			Array.isArray(raw.entries) &&
			Number.isInteger(raw.index) &&
			raw.entries.every((e) => typeof e?.path === 'string' && typeof e?.title === 'string')
		)
			return { entries: raw.entries, index: raw.index };
	} catch {
		// Private mode or broken data: start without a trail.
	}
	return EMPTY_TRAIL;
}

function save() {
	try {
		sessionStorage.setItem(KEY, JSON.stringify({ ...trail, owner }));
	} catch {
		// Without storage the trail only lasts until the next reload.
	}
}

/** Records a finished navigation of the user `userId`. */
export function recordNavigation(userId: string, step: TrailStep, path: string, title: string) {
	const sameUser = userId === owner;
	owner = userId;
	const from = step.type === 'enter' ? load() : sameUser ? trail : EMPTY_TRAIL;
	const real: TrailStep =
		replaceTarget === path && step.type === 'push' ? { type: 'replace' } : step;
	replaceTarget = null;
	trail = advance(from, real, { path, title });
	save();
}

/**
 * `goto()` that replaces the current page instead of adding one – also on the way back.
 * Always use this instead of `goto(…, { replace: true })`.
 */
export function gotoReplace(url: string, options: Parameters<typeof goto>[1] = {}) {
	replaceTarget = pathOf(url, location.href);
	// eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolved paths
	return goto(url, { ...options, replace: true });
}

/** Keeps the title of the current page up to date (e.g. after renaming an account). */
export function retitle(path: string, title: string) {
	const current = trail.entries[trail.index];
	if (!current || current.path !== path || current.title === title) return;
	trail = {
		entries: trail.entries.map((e, i) => (i === trail.index ? { path, title } : e)),
		index: trail.index
	};
	save();
}

/** The page the back button returns to, or null for the fixed parent page. */
export function previousPage() {
	return backTarget(trail);
}
