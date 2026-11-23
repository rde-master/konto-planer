import { fail } from '@sveltejs/kit';
import { THEMES, THEME_COOKIE, type Theme } from '#lib/theme.js';
import { fieldError, formString } from '#lib/server/validation.js';
import { validatePasswordPair } from '#lib/server/user-rules.js';
import { UserError, changeOwnPassword } from '#lib/server/users.js';
import { SESSION_COOKIE } from '#lib/server/session-token.js';
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
	},

	password: async ({ request, cookies, locals }) => {
		if (!locals.user) return fail(401);
		const data = await request.formData();
		const current = formString(data, 'current');
		const password = formString(data, 'password');
		const confirm = formString(data, 'confirm');

		const errors = validatePasswordPair(password, confirm);
		if (errors) return fail(400, { action: 'password' as const, errors });
		try {
			await changeOwnPassword(locals.user, cookies.get(SESSION_COOKIE) ?? '', current, password);
		} catch (e) {
			if (e instanceof UserError)
				return fail(400, {
					action: 'password' as const,
					errors: fieldError('current', e.message)
				});
			throw e;
		}
		return { action: 'password' as const, success: true };
	}
};
