import { fail } from '@sveltejs/kit';
import { ApiError, createToken, listTokens, revokeToken } from '#lib/server/api.js';
import { bookingFormContext } from '#lib/server/bookings.js';
import { formString } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const [tokens, booking] = await Promise.all([listTokens(user.id), bookingFormContext(user)]);
	const accounts = booking.options.bookingAccounts;
	const names = new Map(accounts.map((a) => [a.value, a.label]));
	return {
		/** Address the shortcut sends to. */
		url: `${url.origin}/api/v1/shortcut`,
		/** Address for bank exports; with `?vorschau=1` the file only waits for the preview. */
		importUrl: `${url.origin}/api/v1/shortcut/import`,
		/** The user's accesses for shortcuts (the token itself is shown only once). */
		shortcuts: tokens
			.filter((t) => t.purpose === 'shortcut')
			.map((t) => ({
				id: t.id,
				name: t.name,
				account: t.defaultAccountId ? (names.get(t.defaultAccountId) ?? null) : null,
				lastUsedAt: t.lastUsedAt
			})),
		accounts
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const data = await request.formData();
		try {
			const { token } = await createToken(locals.user!, {
				name: formString(data, 'name') || 'Kurzbefehl',
				purpose: 'shortcut',
				accountIds: null,
				defaultAccountId: formString(data, 'defaultAccountId')
			});
			return { action: 'create' as const, token };
		} catch (e) {
			if (e instanceof ApiError)
				return fail(400, { action: 'create' as const, message: e.message });
			throw e;
		}
	},
	revoke: async ({ request, locals }) => {
		await revokeToken(locals.user!, formString(await request.formData(), 'id'));
		return { action: 'revoke' as const, success: 'Zugang widerrufen.' };
	}
};
