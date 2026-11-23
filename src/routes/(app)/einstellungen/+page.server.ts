import { fail } from '@sveltejs/kit';
import { THEMES, THEME_COOKIE, type Theme } from '#lib/theme.js';
import { fieldError, formString } from '#lib/server/validation.js';
import { validatePasswordPair } from '#lib/server/user-rules.js';
import { UserError, changeOwnPassword } from '#lib/server/users.js';
import { SESSION_COOKIE } from '#lib/server/session-token.js';
import { getSettings, updateSettings } from '#lib/server/settings.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role !== 'admin') return { defaultLeadDays: null };
	return { defaultLeadDays: (await getSettings()).defaultLeadDays };
};

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
	},

	contracts: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403);
		const raw = formString(await request.formData(), 'defaultLeadDays').trim();
		const days = Number(raw);
		if (!/^\d+$/.test(raw) || days > 365)
			return fail(400, {
				action: 'contracts' as const,
				errors: fieldError('defaultLeadDays', 'Bitte 0 bis 365 Tage eingeben.')
			});
		await updateSettings(locals.user, { defaultLeadDays: days });
		return { action: 'contracts' as const, success: true };
	}
};
