import { fail } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guards.js';
import { AccountError, createAccount, listAccountsFor } from '#lib/server/accounts.js';
import { validateAccount } from '#lib/server/account-rules.js';
import { readAccountForm } from '#lib/server/account-form.js';
import { fieldError } from '#lib/server/validation.js';
import { balancesOf } from '#lib/server/bookings.js';
import { plansFor } from '#lib/server/minimum.js';
import { balanceDates } from '#lib/server/import-reminder.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const list = await listAccountsFor(user);
	const balances = await balancesOf(list);
	const [plans, asOf] = await Promise.all([plansFor(user, list, balances), balanceDates(list)]);
	return {
		accounts: list.map((a) => ({
			...a,
			balance: balances.get(a.id) ?? a.openingBalance,
			available: plans.get(a.id)?.plan.available ?? null,
			asOf: asOf.get(a.id) ?? null
		})),
		isAdmin: user.role === 'admin'
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = requireAdmin(locals.user);
		const input = readAccountForm(await request.formData());
		const { values, errors } = validateAccount(input);
		if (!values) return fail(400, { input, errors });
		try {
			await createAccount(actor, values);
		} catch (e) {
			if (e instanceof AccountError)
				return fail(400, { input, errors: fieldError('iban', e.message) });
			throw e;
		}
		return { created: values.name };
	}
};
