import { fail, redirect } from '@sveltejs/kit';
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
import { getBookingFor } from '#lib/server/bookings.js';
import { canBecomeRecurring, recurringPrefill } from '#lib/recurring-from-booking.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const [items, form, settings] = await Promise.all([
		listRecurringFor(user),
		recurringFormContext(user),
		getSettings()
	]);
	// One-off payments live under „Geplant“.
	const shown = items.filter((i) => i.interval !== 'once');
	// "Dauerposten daraus machen": the form opens filled from a booking (?aus=<id>).
	const source = url.searchParams.get('aus');
	const booking = source ? await getBookingFor(user, source) : null;
	const usable =
		booking &&
		booking.canTag &&
		canBecomeRecurring(booking) &&
		form.options.accountOptions.some((a) => a.value === booking.accountId && a.giro);
	return {
		fromBooking: usable ? { id: booking.id, values: recurringPrefill(booking) } : null,
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
		const fromBooking = formString(data, 'fromBooking') || undefined;
		let id: string;
		try {
			id = await createRecurring(user, values, amount.values.amount, contract.values, fromBooking);
		} catch (e) {
			if (e instanceof RecurringError)
				return fail(400, {
					input: { ...input, amount: amountInput },
					errors: { accountId: e.message }
				});
			throw e;
		}
		// From a booking: go straight to the new item.
		if (fromBooking) redirect(303, `/dauerposten/${id}`);
		return { created: values.name };
	}
};
