import { redirect } from '@sveltejs/kit';
import { clearSessionCookie, invalidateSession } from '#lib/server/auth.js';
import { SESSION_COOKIE } from '#lib/server/session-token.js';
import { audit } from '#lib/server/audit.js';
import { db } from '#lib/server/db/index.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) await invalidateSession(token);
	if (locals.user) {
		await audit(db, {
			actor: locals.user,
			entityType: 'auth',
			action: 'logout',
			entityId: locals.user.id,
			entityLabel: locals.user.name
		});
	}
	clearSessionCookie(cookies);
	redirect(303, '/login');
};
