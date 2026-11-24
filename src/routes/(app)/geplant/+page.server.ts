import { fail } from '@sveltejs/kit';
import { inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { dueItems } from '#lib/server/db/schema.js';
import { RecurringError, createRecurring, listRecurringFor } from '#lib/server/recurring.js';
import { validateAmount, validateRecurring } from '#lib/server/recurring-rules.js';
import { recurringFormContext } from '#lib/server/recurring-form.js';
import { fieldError, formString } from '#lib/server/validation.js';
import { nextBankDay } from '#lib/bank-calendar.js';
import { todayBerlin } from '#lib/dates.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const [all, form] = await Promise.all([listRecurringFor(user), recurringFormContext(user)]);
	const items = all.filter((i) => i.interval === 'once');
	const dues = items.length
		? await db
				.select({ recurringId: dueItems.recurringId, status: dueItems.status })
				.from(dueItems)
				.where(
					inArray(
						dueItems.recurringId,
						items.map((i) => i.id)
					)
				)
		: [];
	const status = new Map(dues.map((d) => [d.recurringId, d.status]));
	const today = todayBerlin();
	const rows = items.map((i) => ({
		id: i.id,
		name: i.name,
		kind: i.kind,
		amount: i.amount ?? 0,
		date: i.startDate,
		bookingDate: nextBankDay(i.startDate),
		accountName: i.account.name,
		category: i.category,
		archived: i.archivedAt !== null,
		status: status.get(i.id) ?? null
	}));
	return {
		upcoming: rows
			.filter((r) => !r.archived && r.bookingDate > today)
			.sort((a, b) => a.bookingDate.localeCompare(b.bookingDate)),
		past: rows
			.filter((r) => r.archived || r.bookingDate <= today)
			.sort((a, b) => b.bookingDate.localeCompare(a.bookingDate))
			.slice(0, 30),
		accounts: form.options.accountOptions.filter((a) => a.giro),
		categoryGroups: form.options.categoryGroups,
		today
	};
};

export const actions: Actions = {
	/** A one-off payment is a recurring item with interval "once". */
	create: async ({ request, locals }) => {
		const user = locals.user!;
		const data = await request.formData();
		const input = {
			kind: formString(data, 'kind'),
			name: formString(data, 'name'),
			amount: formString(data, 'amount'),
			startDate: formString(data, 'startDate'),
			accountId: formString(data, 'accountId'),
			categoryId: formString(data, 'categoryId'),
			note: formString(data, 'note')
		};
		const { ctx } = await recurringFormContext(user);
		const kind = input.kind === 'income' ? 'income' : 'expense';
		const { values, errors } = validateRecurring(
			{
				...input,
				kind,
				targetAccountId: '',
				counterparty: '',
				iban: '',
				mandateReference: '',
				creditorId: '',
				interval: 'once',
				customEvery: '',
				customUnit: '',
				endDate: '',
				variable: false,
				isSalary: false,
				paymentMethod: '',
				customerNumber: ''
			},
			ctx
		);
		const amount = validateAmount({ amount: input.amount, validFrom: input.startDate });
		const allErrors: Partial<Record<string, string>> = {
			...(errors ?? {}),
			...(amount.errors?.amount ? { amount: amount.errors.amount } : {})
		};
		if (!allErrors.startDate && input.startDate < todayBerlin())
			allErrors.startDate = 'Das Datum darf nicht in der Vergangenheit liegen.';
		if (!values || !amount.values || Object.keys(allErrors).length)
			return fail(400, { input, errors: allErrors });
		try {
			await createRecurring(user, values, amount.values.amount);
		} catch (e) {
			if (e instanceof RecurringError)
				return fail(400, { input, errors: fieldError('accountId', e.message) });
			throw e;
		}
		return { created: values.name };
	}
};
