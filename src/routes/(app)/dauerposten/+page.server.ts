import { fail } from '@sveltejs/kit';
import { RecurringError, createRecurring, listRecurringFor } from '#lib/server/recurring.js';
import { validateAmount, validateRecurring } from '#lib/server/recurring-rules.js';
import { readRecurringForm, recurringFormContext } from '#lib/server/recurring-form.js';
import { formString } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const [items, form] = await Promise.all([listRecurringFor(user), recurringFormContext(user)]);
	return { items, ...form.options };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const user = locals.user!;
		const data = await request.formData();
		const input = readRecurringForm(data);
		const amountInput = formString(data, 'amount');
		const { ctx } = await recurringFormContext(user);
		const { values, errors } = validateRecurring(input, ctx);
		const amount = validateAmount({ amount: amountInput, validFrom: input.startDate });
		const allErrors = {
			...(errors ?? {}),
			...(amount.errors?.amount ? { amount: amount.errors.amount } : {})
		};
		if (!values || !amount.values)
			return fail(400, { input: { ...input, amount: amountInput }, errors: allErrors });
		try {
			await createRecurring(user, values, amount.values.amount);
		} catch (e) {
			if (e instanceof RecurringError)
				return fail(400, {
					input: { ...input, amount: amountInput },
					errors: { accountId: e.message }
				});
			throw e;
		}
		return { created: values.name };
	}
};
