import { fail } from '@sveltejs/kit';
import { ApiError, createToken, listTokens, revokeToken } from '#lib/server/api.js';
import { listAccountsFor } from '#lib/server/accounts.js';
import { bookingFormContext } from '#lib/server/bookings.js';
import { formString } from '#lib/server/validation.js';
import { haYaml } from '#lib/api.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const [tokens, accounts, booking] = await Promise.all([
		listTokens(user.id),
		listAccountsFor(user),
		bookingFormContext(user)
	]);
	const active = accounts.filter((a) => !a.archivedAt);
	const names = new Map(accounts.map((a) => [a.id, a.name]));
	return {
		tokens: tokens.map((t) => ({
			...t,
			accounts: t.accountIds ? t.accountIds.map((id) => names.get(id) ?? '–') : null
		})),
		accounts: active.map((a) => ({ id: a.id, name: a.name })),
		bookingAccounts: booking.options.bookingAccounts
	};
};

export const actions: Actions = {
	create: async ({ request, locals, url }) => {
		const data = await request.formData();
		const all = formString(data, 'scope') !== 'chosen';
		const chosen = data.getAll('account').filter((v): v is string => typeof v === 'string');
		const user = locals.user!;
		try {
			const { token, purpose } = await createToken(user, {
				name: formString(data, 'name'),
				purpose: formString(data, 'purpose'),
				accountIds: all ? null : chosen,
				defaultAccountId: formString(data, 'defaultAccountId')
			});
			const endpoint = `${url.origin}/api/v1/status`;
			const accounts = (await listAccountsFor(user)).filter(
				(a) => !a.archivedAt && (all || chosen.includes(a.id))
			);
			return {
				success: 'API-Zugang angelegt.',
				token,
				endpoint,
				yaml: purpose === 'home_assistant' ? haYaml(endpoint, token, accounts) : null,
				shortcutUrl: purpose === 'shortcut' ? `${url.origin}/api/v1/shortcut` : null
			};
		} catch (e) {
			if (e instanceof ApiError) return fail(400, { message: e.message });
			throw e;
		}
	},
	revoke: async ({ request, locals }) => {
		await revokeToken(locals.user!, formString(await request.formData(), 'id'));
		return { success: 'API-Zugang widerrufen.' };
	}
};
