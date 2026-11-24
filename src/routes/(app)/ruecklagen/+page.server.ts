import { fail } from '@sveltejs/kit';
import { goalAccounts, GoalError } from '#lib/server/goals.js';
import { createReserve, listReservesFor, type ReserveInput } from '#lib/server/reserves.js';
import { recurringFormContext } from '#lib/server/recurring-form.js';
import { RecurringError } from '#lib/server/recurring.js';
import { fieldError, formString } from '#lib/server/validation.js';
import { todayBerlin } from '#lib/dates.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const [reserves, savings, form] = await Promise.all([
		listReservesFor(user),
		goalAccounts(user),
		recurringFormContext(user)
	]);
	const preselect = url.searchParams.get('posten');
	return {
		reserves,
		savings: savings.map((a) => ({ value: a.id, label: a.name })),
		giro: form.options.accountOptions
			.filter((a) => a.giro)
			.map((a) => ({ value: a.value, label: a.label })),
		preselect: reserves.some((r) => r.id === preselect) ? preselect : null,
		today: todayBerlin()
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const data = await request.formData();
		const input: ReserveInput = {
			recurringId: formString(data, 'recurringId'),
			accountId: formString(data, 'accountId'),
			name: formString(data, 'name'),
			allocated: formString(data, 'allocated'),
			withTransfer: formString(data, 'withTransfer'),
			sourceAccountId: formString(data, 'sourceAccountId'),
			transferAmount: formString(data, 'transferAmount'),
			transferStart: formString(data, 'transferStart')
		};
		try {
			const result = await createReserve(locals.user!, input);
			if ('errors' in result) return fail(400, { input, errors: result.errors });
			return { created: result.name };
		} catch (e) {
			if (e instanceof GoalError || e instanceof RecurringError)
				return fail(400, { input, errors: fieldError('name', e.message) });
			throw e;
		}
	}
};
