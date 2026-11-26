import { redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { prepareDatabase } from '#lib/server/db/migrate.js';
import { startDueScheduler } from '#lib/server/due.js';
import {
	clearSessionCookie,
	hasAnyUser,
	setSessionCookie,
	validateSession
} from '#lib/server/auth.js';
import { SESSION_COOKIE } from '#lib/server/session-token.js';
import { THEME_COOKIE, parseTheme } from '#lib/theme.js';

export const init: ServerInit = async () => {
	if (building) return;
	await prepareDatabase();
	// Background job: provisionally book due items (at start and hourly).
	startDueScheduler();
};

/** Routes reachable without a session. */
const PUBLIC_PATHS = new Set(['/login', '/setup', '/api/health']);

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	event.locals.user = null;
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const result = await validateSession(token);
		if (result) {
			event.locals.user = result.user;
			if (result.renewed) setSessionCookie(event.cookies, token, result.expiresAt);
		} else {
			clearSessionCookie(event.cookies);
		}
	}

	if (pathname !== '/api/health') {
		const setupDone = await hasAnyUser();
		if (!setupDone && pathname !== '/setup') redirect(303, '/setup');
		if (setupDone && pathname === '/setup') redirect(303, '/');
		// Calendar subscriptions carry their own secret token.
		const calendar = pathname.startsWith('/api/kalender/');
		if (!event.locals.user && !PUBLIC_PATHS.has(pathname) && !calendar) {
			const target = pathname + event.url.search;
			redirect(303, target === '/' ? '/login' : `/login?redirectTo=${encodeURIComponent(target)}`);
		}
		if (event.locals.user && pathname === '/login') redirect(303, '/');
	}

	const theme = parseTheme(event.cookies.get(THEME_COOKIE));
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%kp.theme%', theme)
	});

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'same-origin');
	return response;
};
