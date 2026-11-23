import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { loginThrottle } from './db/schema.js';
import { isLocked, lockDurationAfter, previousFailures } from './login-throttle-rules.js';

/** Returns the end of an active lock for this username, or null. */
export async function activeLock(username: string, now = Date.now()): Promise<Date | null> {
	const [row] = await db
		.select({ lockedUntil: loginThrottle.lockedUntil })
		.from(loginThrottle)
		.where(eq(loginThrottle.username, username));
	return row && isLocked(row.lockedUntil, now) ? row.lockedUntil : null;
}

/** Records a failed login; returns the new lock end if this failure started a lock. */
export async function recordFailure(username: string, now = Date.now()): Promise<Date | null> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(loginThrottle)
			.where(eq(loginThrottle.username, username))
			.for('update');
		const failedCount = previousFailures(row?.failedCount ?? 0, row?.lastFailedAt ?? null, now) + 1;
		const duration = lockDurationAfter(failedCount);
		const lockedUntil = duration ? new Date(now + duration) : (row?.lockedUntil ?? null);
		const values = { failedCount, lastFailedAt: new Date(now), lockedUntil };
		await tx
			.insert(loginThrottle)
			.values({ username, ...values })
			.onConflictDoUpdate({ target: loginThrottle.username, set: values });
		return duration ? lockedUntil : null;
	});
}

/** Successful login or admin unlock: forget all failures. */
export async function clearFailures(username: string, executor: Pick<typeof db, 'delete'> = db) {
	await executor.delete(loginThrottle).where(eq(loginThrottle.username, username));
}
