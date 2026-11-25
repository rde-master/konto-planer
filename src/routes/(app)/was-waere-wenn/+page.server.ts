import { fail, redirect } from '@sveltejs/kit';
import {
	ScenarioError,
	createScenario,
	listScenarios,
	scenarioAccounts
} from '#lib/server/scenarios.js';
import { formString } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const [list, accounts] = await Promise.all([listScenarios(user), scenarioAccounts(user)]);
	return { scenarios: list, accounts: accounts.map((a) => ({ value: a.id, label: a.name })) };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const data = await request.formData();
		const input = { name: formString(data, 'name'), accountId: formString(data, 'accountId') };
		let id: string;
		try {
			id = await createScenario(locals.user!, input);
		} catch (e) {
			if (e instanceof ScenarioError) return fail(400, { input, error: e.message });
			throw e;
		}
		redirect(303, `/was-waere-wenn/${id}`);
	}
};
