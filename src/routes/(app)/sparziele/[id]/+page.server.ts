import { error, fail, redirect } from '@sveltejs/kit';
import {
	GoalError,
	allocateGoal,
	deleteGoal,
	getGoalFor,
	linkablePayments,
	updateGoal
} from '#lib/server/goals.js';
import { validateAllocation, validateGoal } from '#lib/server/goal-rules.js';
import { readGoalForm } from '#lib/server/goal-form.js';
import { fieldError, formString } from '#lib/server/validation.js';
import { formatEuroInput } from '#lib/money.js';
import { todayBerlin } from '#lib/dates.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = locals.user!;
	const goal = await getGoalFor(user, params.id);
	if (!goal) error(404, 'Sparziel nicht gefunden.');
	const payments = await linkablePayments(user, goal.recurringId);
	return {
		goal,
		payments: payments.options,
		/** The linked payment is visible to the viewer (link to its page). */
		paymentVisible: goal.recurringId !== null && payments.map.has(goal.recurringId)
	};
};

async function editable(locals: App.Locals, id: string) {
	const goal = await getGoalFor(locals.user!, id);
	if (!goal) error(404, 'Sparziel nicht gefunden.');
	return goal;
}

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const user = locals.user!;
		const goal = await editable(locals, params.id);
		const input = {
			...readGoalForm(await request.formData()),
			allocated: formatEuroInput(goal.allocated)
		};
		const { map } = await linkablePayments(user, goal.recurringId);
		// The goal's own linked payment stays valid while it has due dates.
		const { values, errors } = validateGoal(input, {
			today: todayBerlin(),
			payments: map,
			free: goal.free
		});
		if (!values) {
			const e = { ...errors };
			if (e.allocated) {
				e.targetAmount = 'Es ist schon mehr zurückgelegt; erst den Betrag verringern.';
				delete e.allocated;
			}
			return fail(400, { action: 'update' as const, input, errors: e });
		}
		try {
			await updateGoal(user, params.id, values);
		} catch (err) {
			if (err instanceof GoalError)
				return fail(400, {
					action: 'update' as const,
					input,
					errors: fieldError('name', err.message)
				});
			throw err;
		}
		return { action: 'update' as const, success: 'Änderungen gesichert.' };
	},

	/** "Zurücklegen": the total set aside for the goal. */
	allocate: async ({ request, locals, params }) => {
		const goal = await editable(locals, params.id);
		const raw = formString(await request.formData(), 'allocated');
		const a = validateAllocation(raw, { free: goal.free, target: goal.targetAmount });
		if (a.error !== null)
			return fail(400, { action: 'allocate' as const, input: raw, error: a.error });
		try {
			await allocateGoal(locals.user!, params.id, a.value);
		} catch (err) {
			if (err instanceof GoalError)
				return fail(400, { action: 'allocate' as const, input: raw, error: err.message });
			throw err;
		}
		return { action: 'allocate' as const, success: 'Betrag gesichert.' };
	},

	delete: async ({ locals, params }) => {
		let accountId: string;
		try {
			accountId = await deleteGoal(locals.user!, params.id);
		} catch (err) {
			if (err instanceof GoalError)
				return fail(400, { action: 'delete' as const, message: err.message });
			throw err;
		}
		redirect(303, `/konten/${accountId}`);
	}
};
