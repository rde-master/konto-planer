import { fail } from '@sveltejs/kit';
import {
	SettleError,
	createSettlement,
	deleteSettlement,
	settleOverview,
	settleUsers,
	validateSettlement
} from '#lib/server/settle.js';
import { formString } from '#lib/server/validation.js';
import { todayBerlin } from '#lib/dates.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [overview, people] = await Promise.all([settleOverview(locals.user!), settleUsers()]);
	return { overview, people, today: todayBerlin() };
};

export const actions: Actions = {
	settle: async ({ request, locals }) => {
		const user = locals.user!;
		const data = await request.formData();
		const input = {
			fromUserId: formString(data, 'fromUserId'),
			toUserId: formString(data, 'toUserId'),
			amount: formString(data, 'amount'),
			date: formString(data, 'date'),
			note: formString(data, 'note')
		};
		const people = await settleUsers();
		const { values, errors } = validateSettlement(input, {
			userIds: new Set(people.map((p) => p.id)),
			viewerId: user.id,
			today: todayBerlin()
		});
		if (!values) return fail(400, { action: 'settle' as const, input, errors });
		await createSettlement(user, values);
		return { action: 'settle' as const, success: 'Ausgleich erfasst.' };
	},

	delete: async ({ request, locals }) => {
		try {
			await deleteSettlement(locals.user!, formString(await request.formData(), 'id'));
		} catch (e) {
			if (e instanceof SettleError)
				return fail(400, { action: 'delete' as const, message: e.message });
			throw e;
		}
		return { action: 'delete' as const, success: 'Ausgleich gelöscht.' };
	}
};
