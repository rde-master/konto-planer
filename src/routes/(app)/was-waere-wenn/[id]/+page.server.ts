import { error, fail, redirect } from '@sveltejs/kit';
import {
	ScenarioError,
	addChange,
	deleteScenario,
	removeChange,
	renameScenario,
	scenarioView
} from '#lib/server/scenarios.js';
import { formString } from '#lib/server/validation.js';
import { todayBerlin } from '#lib/dates.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	try {
		return { view: await scenarioView(locals.user!, params.id), today: todayBerlin() };
	} catch (e) {
		if (e instanceof ScenarioError) error(404, e.message);
		throw e;
	}
};

export const actions: Actions = {
	add: async ({ request, locals, params }) => {
		const data = await request.formData();
		const input = {
			kind: formString(data, 'kind'),
			recurringId: formString(data, 'recurringId'),
			name: formString(data, 'name'),
			direction: formString(data, 'direction'),
			interval: formString(data, 'interval'),
			amount: formString(data, 'amount'),
			date: formString(data, 'date')
		};
		try {
			const { errors } = await addChange(locals.user!, params.id, input);
			if (errors) return fail(400, { action: 'add' as const, input, errors });
		} catch (e) {
			if (e instanceof ScenarioError) error(404, e.message);
			throw e;
		}
		return { action: 'add' as const, success: 'Änderung hinzugefügt.' };
	},

	remove: async ({ request, locals, params }) => {
		try {
			await removeChange(locals.user!, params.id, formString(await request.formData(), 'changeId'));
		} catch (e) {
			if (e instanceof ScenarioError)
				return fail(400, { action: 'remove' as const, message: e.message });
			throw e;
		}
		return { action: 'remove' as const, success: 'Änderung entfernt.' };
	},

	rename: async ({ request, locals, params }) => {
		try {
			await renameScenario(locals.user!, params.id, formString(await request.formData(), 'name'));
		} catch (e) {
			if (e instanceof ScenarioError)
				return fail(400, { action: 'rename' as const, message: e.message });
			throw e;
		}
		return { action: 'rename' as const, success: 'Szenario umbenannt.' };
	},

	delete: async ({ locals, params }) => {
		await deleteScenario(locals.user!, params.id);
		redirect(303, '/was-waere-wenn');
	}
};
