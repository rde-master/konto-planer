import { hash, verify } from '@node-rs/argon2';
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { sessions, users, type User } from './db/schema';
import {
	SESSION_COOKIE,
	SESSION_LIFETIME_MS,
	generateSessionToken,
	hashSessionToken,
	isExpired,
	needsRenewal,
	newExpiry
} from './session-token';

export type SessionUser = Pick<User, 'id' | 'username' | 'name' | 'email' | 'role'>;

const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
	return hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
	return verify(passwordHash, password);
}

// A precomputed hash so that unknown usernames take as long as wrong passwords.
let dummyHash: Promise<string> | undefined;
export async function verifyAgainstDummy(password: string): Promise<void> {
	dummyHash ??= hashPassword('dummy-password-for-timing');
	await verify(await dummyHash, password);
}

let hasUsersCache = false;
/** True once at least one user exists. Cached because it never goes back to false. */
export async function hasAnyUser(): Promise<boolean> {
	if (hasUsersCache) return true;
	const row = await db.select({ id: users.id }).from(users).limit(1);
	hasUsersCache = row.length > 0;
	return hasUsersCache;
}

export async function createSession(userId: string, userAgent: string | null) {
	const token = generateSessionToken();
	const expiresAt = newExpiry();
	await db.insert(sessions).values({ id: hashSessionToken(token), userId, expiresAt, userAgent });
	return { token, expiresAt };
}

export async function validateSession(
	token: string
): Promise<{ user: SessionUser; expiresAt: Date; renewed: boolean } | null> {
	const id = hashSessionToken(token);
	const [row] = await db
		.select({
			expiresAt: sessions.expiresAt,
			user: {
				id: users.id,
				username: users.username,
				name: users.name,
				email: users.email,
				role: users.role
			}
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, id));
	if (!row) return null;
	if (isExpired(row.expiresAt)) {
		await db.delete(sessions).where(eq(sessions.id, id));
		return null;
	}
	if (needsRenewal(row.expiresAt)) {
		const expiresAt = newExpiry();
		await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
		return { user: row.user, expiresAt, renewed: true };
	}
	return { user: row.user, expiresAt: row.expiresAt, renewed: false };
}

export async function invalidateSession(token: string) {
	await db.delete(sessions).where(eq(sessions.id, hashSessionToken(token)));
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		expires: expiresAt,
		maxAge: SESSION_LIFETIME_MS / 1000
	});
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
