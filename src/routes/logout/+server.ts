import { redirect } from '@sveltejs/kit';
import { clearSessionCookie, invalidateSession } from '#lib/server/auth.js';
import { SESSION_COOKIE } from '#lib/server/session-token.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) await invalidateSession(token);
	clearSessionCookie(cookies);
	redirect(303, '/login');
};
