// "Alternative Bezeichnungen": bookings of a recurring item show its alternative name instead
// of the bank's payee name. Every user switches this on and off for themselves.
import { and, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { db } from './db/index.js';
import { recurringItems, users } from './db/schema.js';
import { listAccountsFor } from './accounts.js';
import type { Viewer } from './account-rules.js';

export type AltNamePrefs = {
	/** The user wants the alternative names shown. */
	on: boolean;
	/** There is an item with an alternative name the user can see (else no switch is offered). */
	any: boolean;
};

export async function altNamePrefs(viewer: Viewer): Promise<AltNamePrefs> {
	const ids = (await listAccountsFor(viewer)).map((a) => a.id);
	const [[me], named] = await Promise.all([
		db.select({ on: users.altNames }).from(users).where(eq(users.id, viewer.id)),
		ids.length
			? db
					.select({ id: recurringItems.id })
					.from(recurringItems)
					.where(
						and(
							isNotNull(recurringItems.altName),
							or(
								inArray(recurringItems.accountId, ids),
								inArray(recurringItems.targetAccountId, ids)
							)
						)
					)
					.limit(1)
			: Promise.resolve([])
	]);
	return { on: me?.on ?? true, any: named.length > 0 };
}

/** A display setting like the colour scheme: remembered, not logged. */
export async function setAltNames(userId: string, on: boolean) {
	await db.update(users).set({ altNames: on }).where(eq(users.id, userId));
}

/** Alternative names of recurring items by id (only items that have one). */
export async function altNamesOf(ids: (string | null)[]): Promise<Map<string, string>> {
	const wanted = [...new Set(ids.filter((id) => id !== null))];
	if (!wanted.length) return new Map();
	const rows = await db
		.select({ id: recurringItems.id, altName: recurringItems.altName })
		.from(recurringItems)
		.where(and(inArray(recurringItems.id, wanted), isNotNull(recurringItems.altName)));
	return new Map(rows.flatMap((r) => (r.altName ? [[r.id, r.altName] as const] : [])));
}
