import { fail } from '@sveltejs/kit';
import {
	BookingError,
	bookingFormContext,
	createBooking,
	listBookingsFor
} from '#lib/server/bookings.js';
import { validateBooking } from '#lib/server/booking-rules.js';
import { readBookingForm } from '#lib/server/booking-form.js';
import { listAccountsFor } from '#lib/server/accounts.js';
import { formatEuro } from '#lib/money.js';
import type { Actions, PageServerLoad } from './$types';

const PAGE = 100;

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const accounts = await listAccountsFor(user);
	const filter = url.searchParams.get('konto');
	const accountId = accounts.some((a) => a.id === filter) ? filter : null;
	const limit = Math.min(Math.max(Number(url.searchParams.get('anzahl')) || PAGE, PAGE), 5000);
	const { bookings, more } = await listBookingsFor(user, { accountId, limit });
	return {
		bookings,
		more,
		limit,
		accountId,
		accountFilter: accounts.map((a) => ({ value: a.id, label: a.name }))
	};
};

/** Creates a manual booking from the full form or the quick entry. */
async function create(request: Request, user: NonNullable<App.Locals['user']>) {
	const { ctx } = await bookingFormContext(user);
	const input = readBookingForm(await request.formData(), ctx.today);
	const { values, errors } = validateBooking(input, ctx);
	if (!values) return fail(400, { action: 'create', input, errors });
	try {
		await createBooking(user, values);
	} catch (e) {
		if (e instanceof BookingError)
			return fail(400, { action: 'create', input, errors: { accountId: e.message } });
		throw e;
	}
	const account = (await listAccountsFor(user)).find((a) => a.id === values.accountId);
	return {
		action: 'create',
		created: `${formatEuro(values.amount)} auf ${account?.name ?? 'dem Konto'} gebucht.`
	};
}

export const actions: Actions = {
	create: ({ request, locals }) => create(request, locals.user!)
};
