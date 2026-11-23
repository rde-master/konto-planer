import { fail } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guards.js';
import { UserError, createUser, listUsers } from '#lib/server/users.js';
import { parseRole, validateNewUser } from '#lib/server/user-rules.js';
import { fieldError, formString } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals.user);
	return { users: await listUsers() };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const data = await request.formData();
		const input = {
			name: formString(data, 'name'),
			username: formString(data, 'username'),
			email: formString(data, 'email'),
			role: formString(data, 'role'),
			password: formString(data, 'password'),
			confirm: formString(data, 'confirm')
		};
		const values = {
			name: input.name,
			username: input.username,
			email: input.email,
			role: input.role
		};

		const errors = validateNewUser(input);
		const role = parseRole(input.role);
		if (errors || !role) return fail(400, { values, errors: errors ?? {} });

		try {
			await createUser({ ...input, role });
		} catch (e) {
			if (e instanceof UserError) {
				return fail(400, { values, errors: fieldError('username', e.message) });
			}
			throw e;
		}
		return { created: input.name.trim() };
	}
};
