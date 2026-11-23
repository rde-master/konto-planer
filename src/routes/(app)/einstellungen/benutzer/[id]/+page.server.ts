import { error, fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guards.js';
import {
	UserError,
	deleteUser,
	getUser,
	resetPassword,
	unlockUser,
	updateUser
} from '#lib/server/users.js';
import { activeLock } from '#lib/server/login-throttle.js';
import { formatLockedUntil } from '#lib/server/login-throttle-rules.js';
import { parseRole, validatePasswordPair, validateProfile } from '#lib/server/user-rules.js';
import { formString } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requireAdmin(locals.user);
	const target = await getUser(params.id);
	if (!target) error(404, 'Benutzer nicht gefunden.');
	const lockedUntil = await activeLock(target.username);
	return {
		target,
		lockedUntil: lockedUntil ? formatLockedUntil(lockedUntil, Date.now()) : null
	};
};

function userError(action: 'update' | 'reset' | 'delete' | 'unlock', e: unknown) {
	if (e instanceof UserError) return fail(400, { action, message: e.message });
	throw e;
}

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const actor = requireAdmin(locals.user);
		const data = await request.formData();
		const input = {
			name: formString(data, 'name'),
			email: formString(data, 'email'),
			role: formString(data, 'role')
		};
		const errors = validateProfile(input);
		const role = parseRole(input.role);
		if (errors || !role) {
			return fail(400, {
				action: 'update' as const,
				values: input,
				errors: errors ?? {}
			});
		}
		try {
			await updateUser(actor.id, params.id, { ...input, role });
		} catch (e) {
			return userError('update', e);
		}
		return { action: 'update' as const, success: true };
	},

	reset: async ({ request, locals, params }) => {
		requireAdmin(locals.user);
		const data = await request.formData();
		const password = formString(data, 'password');
		const errors = validatePasswordPair(password, formString(data, 'confirm'));
		if (errors) return fail(400, { action: 'reset' as const, errors });
		try {
			await resetPassword(params.id, password);
		} catch (e) {
			return userError('reset', e);
		}
		return { action: 'reset' as const, success: true };
	},

	unlock: async ({ locals, params }) => {
		requireAdmin(locals.user);
		try {
			await unlockUser(params.id);
		} catch (e) {
			return userError('unlock', e);
		}
		return { action: 'unlock' as const, success: true };
	},

	delete: async ({ locals, params }) => {
		const actor = requireAdmin(locals.user);
		try {
			await deleteUser(actor.id, params.id);
		} catch (e) {
			return userError('delete', e);
		}
		redirect(303, '/einstellungen/benutzer');
	}
};
