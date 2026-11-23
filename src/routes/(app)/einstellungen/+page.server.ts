import { fail } from '@sveltejs/kit';
import { THEMES, THEME_COOKIE, type Theme } from '#lib/theme.js';
import { formString } from '#lib/server/validation.js';
import type { Actions } from './$types';

export const actions: Actions = {
	theme: async ({ request, cookies }) => {
		const theme = formString(await request.formData(), 'theme');
		if (!THEMES.includes(theme as Theme)) return fail(400);
		cookies.set(THEME_COOKIE, theme, {
			path: '/',
			httpOnly: false,
			sameSite: 'lax',
			maxAge: 400 * 24 * 3600
		});
		return { theme };
	}
};
