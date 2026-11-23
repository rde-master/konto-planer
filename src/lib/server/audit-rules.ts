type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Snapshot = Record<string, Json>;

/** Keys that must never reach the log, at any depth. */
const SECRET_KEY = /pass(word)?|hash|token|secret|credential/i;

/** Removes secrets and turns dates into ISO strings so the snapshot is plain JSON. */
export function sanitize(value: unknown): Json {
	if (value === null || value === undefined) return null;
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(sanitize);
	if (typeof value === 'object') {
		const out: Record<string, Json> = {};
		for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
			if (SECRET_KEY.test(key) || v === undefined) continue;
			out[key] = sanitize(v);
		}
		return out;
	}
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
		return value;
	if (typeof value === 'bigint') return value.toString();
	return null; // functions, symbols: not loggable
}

export function snapshot(value: Record<string, unknown>): Snapshot {
	return sanitize(value) as Snapshot;
}

/** Only the fields that changed; null if nothing changed (such updates are not logged). */
export function diff(
	before: Record<string, unknown>,
	after: Record<string, unknown>
): { before: Snapshot; after: Snapshot } | null {
	const b = snapshot(before);
	const a = snapshot(after);
	const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
	const changedBefore: Snapshot = {};
	const changedAfter: Snapshot = {};
	for (const key of keys) {
		if (JSON.stringify(b[key] ?? null) === JSON.stringify(a[key] ?? null)) continue;
		changedBefore[key] = b[key] ?? null;
		changedAfter[key] = a[key] ?? null;
	}
	return Object.keys(changedAfter).length ? { before: changedBefore, after: changedAfter } : null;
}

export type AuditFilter = {
	actor?: string;
	entity?: string;
	action?: string;
	from?: string;
	to?: string;
	/** Cursor: show entries older than this id. */
	before?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function validDay(value: string | null): string | undefined {
	if (!value || !DAY.test(value)) return undefined;
	const d = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value) ? value : undefined;
}

/** Reads the filter from the URL; unknown or malformed values are ignored. */
export function parseAuditFilter(
	params: URLSearchParams,
	known: { entities: readonly string[]; actions: readonly string[] }
): AuditFilter {
	const filter: AuditFilter = {};
	const actor = params.get('benutzer');
	if (actor && UUID.test(actor)) filter.actor = actor;
	const entity = params.get('bereich');
	if (entity && known.entities.includes(entity)) filter.entity = entity;
	const action = params.get('aktion');
	if (action && known.actions.includes(action)) filter.action = action;
	const from = validDay(params.get('von'));
	if (from) filter.from = from;
	const to = validDay(params.get('bis'));
	if (to) filter.to = to;
	const before = Number(params.get('vor'));
	if (Number.isSafeInteger(before) && before > 0) filter.before = before;
	return filter;
}
