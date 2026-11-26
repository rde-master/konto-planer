import { redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { prepareDatabase } from '#lib/server/db/migrate.js';
import { startDueScheduler } from '#lib/server/due.js';
import { demoUserId, isDemo, prepareDemo } from '#lib/server/demo.js';
import {
	clearSessionCookie,
	createSession,
	hasAnyUser,
	setSessionCookie,
	validateSession
} from '#lib/server/auth.js';
import { SESSION_COOKIE } from '#lib/server/session-token.js';
import { THEME_COOKIE, parseTheme } from '#lib/theme.js';

export const init: ServerInit = async () => {
	if (building) return;
	await prepareDatabase();
	// Demo instance: invented data on an empty database.
	await prepareDemo();
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

	// Demo instance: every visitor is the demo user (no login page).
	if (isDemo() && !event.locals.user && !pathname.startsWith('/api/')) {
		const id = await demoUserId();
		if (id) {
			const session = await createSession(id, event.request.headers.get('user-agent'));
			setSessionCookie(event.cookies, session.token, session.expiresAt);
			event.locals.user = (await validateSession(session.token))?.user ?? null;
		}
		if (pathname === '/login') redirect(303, '/');
	}

	if (pathname !== '/api/health') {
		const setupDone = await hasAnyUser();
		if (!setupDone && pathname !== '/setup') redirect(303, '/setup');
		if (setupDone && pathname === '/setup') redirect(303, '/');
		// Calendar subscriptions and the read API carry their own secret token.
		const calendar =
			pathname.startsWith('/api/kalender/') ||
			pathname.startsWith('/api/v1/') ||
			pathname === '/api/widget';
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
