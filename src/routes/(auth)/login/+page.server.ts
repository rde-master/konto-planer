import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import {
	createSession,
	setSessionCookie,
	verifyAgainstDummy,
	verifyPassword
} from '#lib/server/auth.js';
import { formString, normalizeUsername } from '#lib/server/validation.js';
import { activeLock, clearFailures, recordFailure } from '#lib/server/login-throttle.js';
import { lockMessage } from '#lib/server/login-throttle-rules.js';
import { audit } from '#lib/server/audit.js';
import { safeRedirectTarget } from '#lib/redirect.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const username = normalizeUsername(formString(data, 'username'));
		const password = formString(data, 'password');

		if (!username) return fail(400, { username, error: 'Benutzername oder Passwort ist falsch.' });

		// While locked, the password is not even checked.
		const lockedUntil = await activeLock(username);
		if (lockedUntil) {
			await audit(db, {
				actor: null,
				entityType: 'auth',
				action: 'login_failed',
				entityLabel: username,
				after: { reason: 'locked' }
			});
			return fail(429, { username, error: lockMessage(lockedUntil, Date.now()) });
		}

		const [user] = await db.select().from(users).where(eq(users.username, username));
		const ok = user
			? await verifyPassword(user.passwordHash, password)
			: (await verifyAgainstDummy(password), false);
		if (!user || !ok) {
			const newLock = await recordFailure(username);
			await audit(db, {
				actor: null,
				entityType: 'auth',
				action: newLock ? 'locked' : 'login_failed',
				entityId: user?.id ?? null,
				entityLabel: username,
				after: newLock ? { lockedUntil: newLock } : { reason: 'wrong_credentials' }
			});
			const error = newLock
				? lockMessage(newLock, Date.now())
				: 'Benutzername oder Passwort ist falsch.';
			return fail(newLock ? 429 : 400, { username, error });
		}

		await clearFailures(username);
		await audit(db, {
			actor: { id: user.id, name: user.name },
			entityType: 'auth',
			action: 'login',
			entityId: user.id,
			entityLabel: user.name
		});

		const session = await createSession(user.id, request.headers.get('user-agent'));
		setSessionCookie(cookies, session.token, session.expiresAt);
		redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
	}
};
