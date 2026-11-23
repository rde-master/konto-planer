import { fail } from '@sveltejs/kit';
import {
	RecurringError,
	accountsForNewItems,
	createRecurring,
	listRecurringFor
} from '#lib/server/recurring.js';
import { validateAmount, validateRecurring } from '#lib/server/recurring-rules.js';
import { categoryGroups, readRecurringForm } from '#lib/server/recurring-form.js';
import { listCategories } from '#lib/server/categories.js';
import { buildTree } from '#lib/server/category-rules.js';
import { formString } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const [items, accounts, categories] = await Promise.all([
		listRecurringFor(user),
		accountsForNewItems(user),
		listCategories()
	]);
	return {
		items,
		accountOptions: accounts.map((a) => ({ value: a.id, label: a.name })),
		categoryGroups: categoryGroups(buildTree(categories))
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const user = locals.user!;
		const data = await request.formData();
		const input = readRecurringForm(data);
		const amountInput = formString(data, 'amount');
		const [accounts, categories] = await Promise.all([accountsForNewItems(user), listCategories()]);
		const { values, errors } = validateRecurring(input, {
			accountIds: new Set(accounts.map((a) => a.id)),
			categoryIds: new Set(categories.map((c) => c.id))
		});
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
