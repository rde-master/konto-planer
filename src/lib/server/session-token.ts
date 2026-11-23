import { createHash, randomBytes } from 'node:crypto';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Browsers cap cookie lifetime at 400 days, so this is "as long as possible". */
export const SESSION_LIFETIME_MS = 400 * DAY_MS;
/** Extend the session once less than this remains, so active devices stay logged in. */
export const SESSION_RENEW_THRESHOLD_MS = 370 * DAY_MS;

export const SESSION_COOKIE = 'kp_session';

export function generateSessionToken(): string {
	return randomBytes(32).toString('base64url');
}

/** Only the hash is stored in the database; a leaked DB row cannot be used as a cookie. */
export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function newExpiry(now = Date.now()): Date {
	return new Date(now + SESSION_LIFETIME_MS);
}

export function isExpired(expiresAt: Date, now = Date.now()): boolean {
	return expiresAt.getTime() <= now;
}

export function needsRenewal(expiresAt: Date, now = Date.now()): boolean {
	return expiresAt.getTime() - now < SESSION_RENEW_THRESHOLD_MS;
}
