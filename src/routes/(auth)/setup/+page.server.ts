import { fail, redirect } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import { createSession, hasAnyUser, hashPassword, setSessionCookie } from '#lib/server/auth.js';
import { audit } from '#lib/server/audit.js';
import {
	formString,
	normalizeUsername,
	validateEmail,
	validatePassword,
	validateUsername,
	type FieldErrors
} from '#lib/server/validation.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		if (await hasAnyUser()) redirect(303, '/login');

		const data = await request.formData();
		const name = formString(data, 'name').trim();
		const username = normalizeUsername(formString(data, 'username'));
		const email = formString(data, 'email').trim();
		const password = formString(data, 'password');
		const confirm = formString(data, 'confirm');

		const errors: FieldErrors = {
			name: name ? undefined : 'Bitte einen Namen angeben.',
			username: validateUsername(username),
			email: validateEmail(email),
			password: validatePassword(password),
			confirm: password === confirm ? undefined : 'Die Passwörter stimmen nicht überein.'
		};
		if (Object.values(errors).some(Boolean)) {
			return fail(400, { name, username, email, errors });
		}

		// The first admin can only be created while the users table is empty; the transaction
		// with a table lock prevents two simultaneous setup requests from both succeeding.
		const created = await db.transaction(async (tx) => {
			await tx.execute(sql`lock table users in exclusive mode`);
			const existing = await tx.select({ id: users.id }).from(users).limit(1);
			if (existing.length > 0) return null;
			const [user] = await tx
				.insert(users)
				.values({
					name,
					username,
					email: email || null,
					passwordHash: await hashPassword(password),
					role: 'admin'
				})
				.returning({ id: users.id });
			if (user) {
				await audit(tx, {
					actor: { id: user.id, name },
					entityType: 'user',
					action: 'create',
					entityId: user.id,
					entityLabel: name,
					after: { name, username, email: email || null, role: 'admin' }
				});
			}
			return user;
		});
		if (!created) redirect(303, '/login');

		const session = await createSession(created.id, request.headers.get('user-agent'));
		setSessionCookie(cookies, session.token, session.expiresAt);
		redirect(303, '/');
	}
};
