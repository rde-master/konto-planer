import { redirect } from '@sveltejs/kit';
import { THEME_COOKIE, parseTheme } from '#lib/theme.js';
import { bookingFormContext } from '#lib/server/bookings.js';
import { quickTemplates } from '#lib/server/templates.js';
import { unseenChanges } from '#lib/server/changelog.js';
import { altNamePrefs } from '#lib/server/alt-names.js';
import { isDemo } from '#lib/server/demo-mode.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) redirect(303, '/login');
	const { options, ctx } = await bookingFormContext(locals.user);
	const templates = options.bookingAccounts.length
		? await quickTemplates(locals.user, ctx.accountIds)
		: [];
	return {
		user: locals.user,
		theme: parseTheme(cookies.get(THEME_COOKIE)),
		/** Options of the quick entry (plus button on every page). */
		quickEntry: { ...options, templates },
		/** "Was ist neu" after an update (once per user and version). */
		whatsNew: await unseenChanges(locals.user),
		/** Bookings show the alternative name of their recurring item (switch on those pages). */
		altNames: await altNamePrefs(locals.user),
		demo: isDemo()
	};
};
