const MINUTE = 60 * 1000;

/** Every this many consecutive failures the username is locked. */
export const ATTEMPTS_PER_LOCK = 5;
/** Lock durations for the 1st, 2nd and every further lock. */
export const LOCK_STEPS_MS = [15 * MINUTE, 60 * MINUTE, 24 * 60 * MINUTE] as const;
/** Failures older than this no longer count. */
export const FAILURE_MEMORY_MS = 24 * 60 * MINUTE;

/** Lock duration after the given number of consecutive failures, or null if no lock starts now. */
export function lockDurationAfter(failedCount: number): number | null {
	if (failedCount <= 0 || failedCount % ATTEMPTS_PER_LOCK !== 0) return null;
	const step = Math.min(failedCount / ATTEMPTS_PER_LOCK, LOCK_STEPS_MS.length) - 1;
	return LOCK_STEPS_MS[step];
}

/** The failure counter to continue from: starts over when the last failure is old. */
export function previousFailures(
	failedCount: number,
	lastFailedAt: Date | null,
	now: number
): number {
	if (!lastFailedAt || now - lastFailedAt.getTime() > FAILURE_MEMORY_MS) return 0;
	return failedCount;
}

export function isLocked(lockedUntil: Date | null, now: number): boolean {
	return !!lockedUntil && lockedUntil.getTime() > now;
}

const timeFormat = new Intl.DateTimeFormat('de-DE', {
	timeZone: 'Europe/Berlin',
	hour: '2-digit',
	minute: '2-digit'
});
const dateTimeFormat = new Intl.DateTimeFormat('de-DE', {
	timeZone: 'Europe/Berlin',
	day: '2-digit',
	month: '2-digit',
	hour: '2-digit',
	minute: '2-digit'
});

/** "14:35 Uhr" today, otherwise "24.11., 14:35 Uhr" (Europe/Berlin). */
export function formatLockedUntil(lockedUntil: Date, now: number): string {
	const sameDay =
		new Date(now).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }) ===
		lockedUntil.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
	return `${(sameDay ? timeFormat : dateTimeFormat).format(lockedUntil)} Uhr`;
}

export function lockMessage(lockedUntil: Date, now: number): string {
	return `Zu viele Fehlversuche. Anmeldung wieder möglich ab ${formatLockedUntil(lockedUntil, now)}.`;
}
