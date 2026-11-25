import { fail } from '@sveltejs/kit';
import { RecurringError, createRecurring, listRecurringFor } from '#lib/server/recurring.js';
import {
	validateAmount,
	validateContract,
	validateRecurring
} from '#lib/server/recurring-rules.js';
import {
	readContractForm,
	readRecurringForm,
	recurringFormContext
} from '#lib/server/recurring-form.js';
import { getSettings } from '#lib/server/settings.js';
import { formString } from '#lib/server/validation.js';
import { itemLogos } from '#lib/server/logos.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const [items, form, settings] = await Promise.all([
		listRecurringFor(user),
		recurringFormContext(user),
		getSettings()
	]);
	// One-off payments live under „Geplant“.
	const shown = items.filter((i) => i.interval !== 'once');
	return {
		items: shown,
		logos: await itemLogos(shown),
		plannedCount: items.filter((i) => i.interval === 'once' && !i.archivedAt).length,
		...form.options,
		defaultLeadDays: settings.defaultLeadDays
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const user = locals.user!;
		const data = await request.formData();
		const input = { ...readRecurringForm(data), ...readContractForm(data) };
		const amountInput = formString(data, 'amount');
		const { ctx } = await recurringFormContext(user);
		const { values, errors } = validateRecurring(input, ctx);
		const amount = validateAmount({ amount: amountInput, validFrom: input.startDate });
		const contract = validateContract(input, input.kind);
		const allErrors = {
			...(errors ?? {}),
			...(contract.errors ?? {}),
			...(amount.errors?.amount ? { amount: amount.errors.amount } : {})
		};
		if (!values || !amount.values || contract.errors)
			return fail(400, { input: { ...input, amount: amountInput }, errors: allErrors });
		try {
			await createRecurring(user, values, amount.values.amount, contract.values);
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
