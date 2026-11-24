import { fail } from '@sveltejs/kit';
import {
	GoalError,
	createGoal,
	freeOf,
	goalAccounts,
	linkablePayments,
	listGoalsFor
} from '#lib/server/goals.js';
import { validateGoal } from '#lib/server/goal-rules.js';
import { readGoalForm } from '#lib/server/goal-form.js';
import { fieldError, formString } from '#lib/server/validation.js';
import { todayBerlin } from '#lib/dates.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const [goals, accounts, payments] = await Promise.all([
		listGoalsFor(user),
		goalAccounts(user),
		linkablePayments(user)
	]);
	const preselect = url.searchParams.get('konto');
	return {
		goals,
		accounts: accounts.map((a) => ({ value: a.id, label: a.name })),
		payments: payments.options,
		preselect: accounts.some((a) => a.id === preselect) ? preselect : null,
		today: todayBerlin()
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const user = locals.user!;
		const data = await request.formData();
		const input = readGoalForm(data);
		const accountId = formString(data, 'accountId');
		const account = (await goalAccounts(user)).find((a) => a.id === accountId);
		if (!account)
			return fail(400, {
				input: { ...input, accountId },
				errors: fieldError('accountId', 'Bitte ein Sparbuch wählen.')
			});
		const [{ map }, { free }] = await Promise.all([linkablePayments(user), freeOf(account)]);
		const { values, errors } = validateGoal(input, { today: todayBerlin(), payments: map, free });
		if (!values) return fail(400, { input: { ...input, accountId }, errors });
		try {
			await createGoal(user, accountId, values);
		} catch (e) {
			if (e instanceof GoalError)
				return fail(400, { input: { ...input, accountId }, errors: fieldError('name', e.message) });
			throw e;
		}
		return { created: values.name };
	}
};
