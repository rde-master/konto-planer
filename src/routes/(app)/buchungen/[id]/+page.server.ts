import { error, fail, redirect } from '@sveltejs/kit';
import {
	BookingError,
	bookingFormContext,
	deleteBooking,
	getBookingFor,
	updateBooking
} from '#lib/server/bookings.js';
import { validateBooking } from '#lib/server/booking-rules.js';
import { readBookingForm } from '#lib/server/booking-form.js';
import { TemplateError, createTemplate } from '#lib/server/templates.js';
import { validateTemplate } from '#lib/server/template-rules.js';
import { readTemplateForm, templateFormContext } from '#lib/server/template-form.js';
import { fieldError, formString } from '#lib/server/validation.js';
import { DueError, changeDue, dueForBooking, skipDue } from '#lib/server/due.js';
import { parseEuro } from '#lib/money.js';
import { InterestError, creditForBooking, setCreditAmount } from '#lib/server/interest.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const booking = await getBookingFor(locals.user!, params.id);
	if (!booking) error(404, 'Buchung nicht gefunden.');
	const { options } = await bookingFormContext(locals.user!);
	// The current account stays selectable while editing.
	const accounts = options.bookingAccounts.some((a) => a.value === booking.accountId)
		? options.bookingAccounts
		: [{ value: booking.accountId, label: booking.account.name }, ...options.bookingAccounts];
	const due =
		booking.source === 'provisional' ? await dueForBooking(locals.user!, booking.id) : null;
	const credit =
		booking.source === 'interest' ? await creditForBooking(locals.user!, booking.id) : null;
	return {
		booking,
		due,
		credit,
		accounts,
		categoryGroups: options.categoryGroups,
		/** Accounts a template may name: only those the user can book on. */
		templateAccounts: options.bookingAccounts
	};
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const user = locals.user!;
		const { ctx } = await bookingFormContext(user);
		const input = readBookingForm(await request.formData(), ctx.today);
		const booking = await getBookingFor(user, params.id);
		if (!booking) error(404, 'Buchung nicht gefunden.');
		ctx.accountIds.add(booking.accountId);
		const { values, errors } = validateBooking(input, ctx);
		if (!values) return fail(400, { action: 'update', input, errors });
		try {
			await updateBooking(user, params.id, values);
		} catch (e) {
			if (e instanceof BookingError) return fail(400, { action: 'update', message: e.message });
			throw e;
		}
		return { action: 'update', success: true };
	},

	/** "Als Vorlage sichern": a new quick-entry template from this booking's values. */
	saveTemplate: async ({ request, locals, params }) => {
		const user = locals.user!;
		if (!(await getBookingFor(user, params.id))) error(404, 'Buchung nicht gefunden.');
		const input = readTemplateForm(await request.formData());
		const { ctx } = await templateFormContext(user);
		const { values, errors } = validateTemplate(input, ctx);
		if (!values) return fail(400, { action: 'saveTemplate', input, errors });
		try {
			await createTemplate(user, values);
		} catch (e) {
			if (e instanceof TemplateError)
				return fail(400, {
					action: 'saveTemplate',
					input,
					errors: fieldError('name', e.message)
				});
			throw e;
		}
		return { action: 'saveTemplate', template: values.name };
	},

	/** Provisional booking: "Verschieben" and "Betrag anpassen" change the due item. */
	changeDue: async ({ request, locals, params }) => {
		const user = locals.user!;
		const due = await dueForBooking(user, params.id);
		if (!due) error(404, 'Buchung nicht gefunden.');
		const data = await request.formData();
		const change: { bookingDate?: string; amount?: number } = {};
		if (data.has('bookingDate')) change.bookingDate = formString(data, 'bookingDate');
		if (data.has('amount')) {
			const cents = parseEuro(formString(data, 'amount'));
			if (cents === null || cents <= 0)
				return fail(400, {
					action: 'changeDue',
					errors: fieldError('amount', 'Bitte einen Betrag größer 0 eingeben, z. B. 87,40.')
				});
			change.amount = cents;
		}
		try {
			await changeDue(user, due.id, change);
		} catch (e) {
			if (e instanceof DueError)
				return fail(400, {
					action: 'changeDue',
					errors: fieldError(change.amount ? 'amount' : 'bookingDate', e.message)
				});
			throw e;
		}
		return { action: 'changeDue', success: true };
	},

	/** Interest credit: the amount of the bank, or back to the computed one. */
	creditAmount: async ({ request, locals, params }) => {
		const user = locals.user!;
		const credit = await creditForBooking(user, params.id);
		if (!credit) error(404, 'Buchung nicht gefunden.');
		const data = await request.formData();
		let amount: number | null = null;
		if (formString(data, 'reset') !== 'on') {
			amount = parseEuro(formString(data, 'amount'));
			if (amount === null || amount <= 0)
				return fail(400, {
					action: 'creditAmount',
					errors: fieldError('amount', 'Bitte einen Betrag größer 0 eingeben, z. B. 12,34.')
				});
		}
		try {
			await setCreditAmount(user, credit.id, amount);
		} catch (e) {
			if (e instanceof InterestError)
				return fail(400, { action: 'creditAmount', errors: fieldError('amount', e.message) });
			throw e;
		}
		return { action: 'creditAmount', success: true };
	},

	skipDue: async ({ locals, params }) => {
		const user = locals.user!;
		const due = await dueForBooking(user, params.id);
		if (!due) error(404, 'Buchung nicht gefunden.');
		try {
			await skipDue(user, due.id);
		} catch (e) {
			if (e instanceof DueError) return fail(400, { action: 'skipDue', message: e.message });
			throw e;
		}
		redirect(303, `/dauerposten/${due.recurringId}`);
	},

	delete: async ({ locals, params }) => {
		try {
			await deleteBooking(locals.user!, params.id);
		} catch (e) {
			if (e instanceof BookingError) return fail(400, { action: 'delete', message: e.message });
			throw e;
		}
		redirect(303, '/buchungen');
	}
};
