import { error, fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guards.js';
import {
	AccountError,
	accountHasData,
	deleteAccount,
	getAccountFor,
	listAccess,
	setAccess,
	setArchived,
	updateAccount
} from '#lib/server/accounts.js';
import { ACCESS_LEVELS, validateAccount, type AccessLevel } from '#lib/server/account-rules.js';
import { readAccountForm } from '#lib/server/account-form.js';
import { fieldError } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = locals.user!;
	const account = await getAccountFor(user, params.id);
	if (!account) error(404, 'Konto nicht gefunden.');
	const isAdmin = user.role === 'admin';
	return {
		account,
		isAdmin,
		access: isAdmin ? await listAccess(account.id) : [],
		hasData: isAdmin ? await accountHasData(account.id) : true
	};
};

function accountError(action: string, e: unknown) {
	if (e instanceof AccountError) return fail(400, { action, message: e.message });
	throw e;
}

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const user = locals.user!;
		const account = await getAccountFor(user, params.id);
		if (!account) error(404, 'Konto nicht gefunden.');
		const input = readAccountForm(await request.formData(), account.type);
		const { values, errors } = validateAccount(input);
		if (!values) return fail(400, { action: 'update' as const, input, errors });
		try {
			await updateAccount(user, params.id, values);
		} catch (e) {
			if (e instanceof AccountError && e.message.includes('IBAN')) {
				return fail(400, {
					action: 'update' as const,
					input,
					errors: fieldError('iban', e.message)
				});
			}
			return accountError('update', e);
		}
		return { action: 'update' as const, success: true };
	},

	access: async ({ request, locals, params }) => {
		const actor = requireAdmin(locals.user);
		const data = await request.formData();
		const wanted: Record<string, AccessLevel | null> = {};
		for (const [key, value] of data) {
			if (!key.startsWith('access:') || typeof value !== 'string') continue;
			wanted[key.slice('access:'.length)] = ACCESS_LEVELS.find((l) => l === value) ?? null;
		}
		try {
			await setAccess(actor, params.id, wanted);
		} catch (e) {
			return accountError('access', e);
		}
		return { action: 'access' as const, success: true };
	},

	archive: async ({ locals, params }) => {
		const actor = requireAdmin(locals.user);
		try {
			await setArchived(actor, params.id, true);
		} catch (e) {
			return accountError('archive', e);
		}
		return { action: 'archive' as const, success: true };
	},

	restore: async ({ locals, params }) => {
		const actor = requireAdmin(locals.user);
		try {
			await setArchived(actor, params.id, false);
		} catch (e) {
			return accountError('restore', e);
		}
		return { action: 'restore' as const, success: true };
	},

	delete: async ({ locals, params }) => {
		const actor = requireAdmin(locals.user);
		try {
			await deleteAccount(actor, params.id);
		} catch (e) {
			return accountError('delete', e);
		}
		redirect(303, '/konten');
	}
};
