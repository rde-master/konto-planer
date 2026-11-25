import { fail } from '@sveltejs/kit';
import {
	BookingError,
	bookingFormContext,
	balanceOf,
	createBooking,
	listBookingsFor
} from '#lib/server/bookings.js';
import { validateBooking } from '#lib/server/booking-rules.js';
import { readBookingForm } from '#lib/server/booking-form.js';
import { listAccountsFor } from '#lib/server/accounts.js';
import { formatEuro } from '#lib/money.js';
import { parseFilter } from '#lib/search.js';
import { listCategories } from '#lib/server/categories.js';
import { buildTree } from '#lib/server/category-rules.js';
import { categoryGroups } from '#lib/server/recurring-form.js';
import { listTags } from '#lib/server/tags.js';
import { budgetHint } from '#lib/server/budgets.js';
import type { Actions, PageServerLoad } from './$types';

const PAGE = 100;

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const [accounts, cats, allTags] = await Promise.all([
		listAccountsFor(user),
		listCategories(),
		listTags()
	]);
	const filter = parseFilter(url.searchParams, {
		accountIds: new Set(accounts.map((a) => a.id)),
		categoryIds: new Set(cats.map((c) => c.id)),
		tagIds: new Set(allTags.map((t) => t.id))
	});
	const limit = Math.min(Math.max(Number(url.searchParams.get('anzahl')) || PAGE, PAGE), 5000);
	const { bookings, more, total } = await listBookingsFor(user, {
		accountId: filter.accountId,
		limit,
		filter
	});
	const byId = new Map(cats.map((c) => [c.id, c]));
	return {
		bookings,
		more,
		total,
		limit,
		filter,
		accountId: filter.accountId,
		accountFilter: accounts.map((a) => ({ value: a.id, label: a.name })),
		categoryGroups: categoryGroups(buildTree(cats)),
		categoryNames: Object.fromEntries(
			cats.map((c) => {
				const parent = c.parentId ? byId.get(c.parentId) : undefined;
				return [c.id, parent ? `${parent.name} › ${c.name}` : c.name];
			})
		),
		tags: allTags.map((t) => ({ value: t.id, label: t.name }))
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
	const balance = account ? ` Neuer Stand: ${formatEuro(await balanceOf(account))}.` : '';
	const hint = await budgetHint(
		user,
		values.categoryId,
		values.accountId,
		values.bookingDate.slice(0, 7)
	);
	return {
		action: 'create',
		created: `${formatEuro(values.amount)} auf ${account?.name ?? 'dem Konto'} gebucht.${balance}${hint ? ` ${hint}.` : ''}`
	};
}

export const actions: Actions = {
	create: ({ request, locals }) => create(request, locals.user!)
};
