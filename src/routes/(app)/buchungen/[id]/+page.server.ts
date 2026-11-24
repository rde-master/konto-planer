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
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const booking = await getBookingFor(locals.user!, params.id);
	if (!booking) error(404, 'Buchung nicht gefunden.');
	const { options } = await bookingFormContext(locals.user!);
	// The current account stays selectable while editing.
	const accounts = options.bookingAccounts.some((a) => a.value === booking.accountId)
		? options.bookingAccounts
		: [{ value: booking.accountId, label: booking.account.name }, ...options.bookingAccounts];
	return { booking, accounts, categoryGroups: options.categoryGroups };
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
