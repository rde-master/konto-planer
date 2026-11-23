import { redirect } from '@sveltejs/kit';
import { THEME_COOKIE, parseTheme } from '#lib/theme.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, cookies }) => {
	if (!locals.user) redirect(303, '/login');
	return { user: locals.user, theme: parseTheme(cookies.get(THEME_COOKIE)) };
};
