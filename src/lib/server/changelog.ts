import changelog from '../../../CHANGELOG.md?raw';
import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { users } from './db/schema.js';
import { changesSince, parseChangelog } from '../system.js';

const entries = parseChangelog(changelog);

/** All versions (newest first) for "Was ist neu" in the settings. */
export function allChanges(limit = 20) {
	return entries.slice(0, limit);
}

/**
 * What the user has not seen yet. A user without a seen version (new account) starts at the
 * current one, so the whole history is not shown.
 */
export async function unseenChanges(user: { id: string }, current = __APP_VERSION__) {
	const [row] = await db
		.select({ seen: users.lastSeenVersion })
		.from(users)
		.where(eq(users.id, user.id));
	if (!row?.seen) {
		await markSeen(user, current);
		return [];
	}
	return changesSince(entries, row.seen, current);
}

export async function markSeen(user: { id: string }, version = __APP_VERSION__) {
	await db.update(users).set({ lastSeenVersion: version }).where(eq(users.id, user.id));
}
