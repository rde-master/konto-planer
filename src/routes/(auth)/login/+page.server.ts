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
import { safeRedirectTarget } from '#lib/redirect.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const username = normalizeUsername(formString(data, 'username'));
		const password = formString(data, 'password');

		const [user] = await db.select().from(users).where(eq(users.username, username));
		const ok = user
			? await verifyPassword(user.passwordHash, password)
			: (await verifyAgainstDummy(password), false);
		if (!user || !ok) {
			return fail(400, { username, error: 'Benutzername oder Passwort ist falsch.' });
		}

		const session = await createSession(user.id, request.headers.get('user-agent'));
		setSessionCookie(cookies, session.token, session.expiresAt);
		redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
	}
};
