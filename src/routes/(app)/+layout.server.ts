import { redirect } from '@sveltejs/kit';
import { THEME_COOKIE, parseTheme } from '#lib/theme.js';
import { bookingFormContext } from '#lib/server/bookings.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) redirect(303, '/login');
	const { options } = await bookingFormContext(locals.user);
	return {
		user: locals.user,
		theme: parseTheme(cookies.get(THEME_COOKIE)),
		/** Options of the quick entry (plus button on every page). */
		quickEntry: options
	};
};
