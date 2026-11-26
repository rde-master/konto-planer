import { error, fail, redirect } from '@sveltejs/kit';
import {
	BookingError,
	bookingFormContext,
	deleteBooking,
	getBookingFor,
	setBookingCategory,
	setSplit,
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
import { GoalError, goalTransferForBooking, undoGoalTransfer } from '#lib/server/goals.js';
import { validateSplit } from '#lib/splits.js';
import { TagError, listTags, readTagForm, setBookingTags, tagsOf } from '#lib/server/tags.js';
import { db } from '#lib/server/db/index.js';
import { LogoError } from '#lib/server/logos.js';
import { canBecomeRecurring } from '#lib/recurring-from-booking.js';
import { setPayeeLogoFromForm } from '#lib/server/web-logos.js';
import {
	SettleError,
	setShared,
	settleUsers,
	sharedOf,
	unsetShared,
	validateShares
} from '#lib/server/settle.js';
import {
	AssignError,
	assignBooking,
	assignOptions,
	assignedItem,
	canUnassign,
	unassignBooking
} from '#lib/server/recurring-assign.js';
import {
	TransferError,
	linkTransfer,
	releaseTransfer,
	transferOf,
	transferOptions
} from '#lib/server/transfers.js';
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
	const goalTransfer =
		booking.source === 'goal' ? await goalTransferForBooking(locals.user!, booking.id) : null;
	const [tagMap, allTags] = await Promise.all([
		tagsOf(db, [booking.id], booking.recurringId ? [booking.recurringId] : []),
		listTags()
	]);
	const [shared, settleUsersList] = await Promise.all([
		sharedOf(booking.id, booking.amount),
		settleUsers()
	]);
	const real = booking.source === 'manual' || booking.source === 'import';
	const [assignable, assigned, transfer, transferTargets] = await Promise.all([
		assignOptions(booking),
		real ? assignedItem(booking) : null,
		transferOf(locals.user!, booking),
		transferOptions(booking)
	]);
	return {
		/** Other side of a transfer between two accounts (null = a plain booking). */
		transfer,
		/** "Als Umbuchung kennzeichnen": the other active accounts. */
		transferTargets,
		/** "Dauerposten zuordnen": items of the account in the booking's direction. */
		assignOptions: assignable,
		/** Item a real payment belongs to, and whether it can be released from it. */
		assigned,
		canUnassign: canUnassign(booking),
		shared,
		settleUsers: settleUsersList,
		canShare:
			booking.canTag &&
			booking.amount < 0 &&
			(booking.source === 'manual' || booking.source === 'import'),
		tags: {
			all: allTags.map((t) => ({ id: t.id, name: t.name })),
			selected: tagMap.booking.get(booking.id) ?? [],
			inherited: booking.recurringId ? (tagMap.recurring.get(booking.recurringId) ?? []) : []
		},
		booking,
		due,
		credit,
		goalTransfer,
		accounts,
		categoryGroups: options.categoryGroups,
		/** Accounts a template may name: only those the user can book on. */
		templateAccounts: options.bookingAccounts,
		/** "Dauerposten daraus machen": real payments without an item, on an account to book on. */
		canMakeRecurring:
			booking.canTag &&
			canBecomeRecurring(booking) &&
			options.bookingAccounts.some((a) => a.value === booking.accountId)
	};
};

export const actions: Actions = {
	/** "Dauerposten zuordnen": the booking pays the nearest open due date of the item. */
	assign: async ({ request, locals, params }) => {
		const recurringId = formString(await request.formData(), 'recurringId');
		try {
			const result = await assignBooking(locals.user!, params.id, recurringId);
			return { action: 'assign' as const, success: true, ...result };
		} catch (e) {
			if (e instanceof AssignError) return fail(400, { action: 'assign', message: e.message });
			throw e;
		}
	},

	/** "Als Umbuchung kennzeichnen": links or creates the other side on the chosen account. */
	transfer: async ({ request, locals, params }) => {
		const accountId = formString(await request.formData(), 'counterAccountId');
		try {
			const result = await linkTransfer(locals.user!, params.id, accountId);
			return { action: 'transfer' as const, success: true, ...result };
		} catch (e) {
			if (e instanceof TransferError) return fail(400, { action: 'transfer', message: e.message });
			throw e;
		}
	},

	/** "Umbuchung auflösen": both bookings stand alone again; optionally the other side goes. */
	untransfer: async ({ request, locals, params }) => {
		const remove = formString(await request.formData(), 'remove') === 'on';
		try {
			const result = await releaseTransfer(locals.user!, params.id, remove);
			return { action: 'untransfer' as const, success: true, ...result };
		} catch (e) {
			if (e instanceof TransferError)
				return fail(400, { action: 'untransfer', message: e.message });
			throw e;
		}
	},

	/** "Zuordnung lösen": the booking leaves its item, the due date is open again. */
	unassign: async ({ locals, params }) => {
		try {
			const result = await unassignBooking(locals.user!, params.id);
			return { action: 'unassign' as const, success: true, ...result };
		} catch (e) {
			if (e instanceof AssignError) return fail(400, { action: 'unassign', message: e.message });
			throw e;
		}
	},

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

	share: async ({ request, locals, params }) => {
		const user = locals.user!;
		const data = await request.formData();
		const participants = data
			.getAll('participant')
			.filter((v): v is string => typeof v === 'string');
		const percents: Record<string, string> = {};
		for (const [k, v] of data.entries())
			if (k.startsWith('percent-') && typeof v === 'string') percents[k.slice(8)] = v;
		const userIds = new Set((await settleUsers()).map((u) => u.id));
		const { values, errors } = validateShares(
			{ payerId: formString(data, 'payerId'), participants, percents },
			userIds
		);
		if (!values) return fail(400, { action: 'share', shareErrors: errors });
		try {
			await setShared(user, params.id, values);
		} catch (e) {
			if (e instanceof SettleError)
				return fail(400, { action: 'share', shareErrors: { shares: e.message } });
			throw e;
		}
		return { action: 'share', success: true };
	},

	unshare: async ({ locals, params }) => {
		try {
			await unsetShared(locals.user!, params.id);
		} catch (e) {
			if (e instanceof SettleError) return fail(400, { action: 'unshare', message: e.message });
			throw e;
		}
		return { action: 'unshare', success: true };
	},

	/** Logo of the payee (for all its bookings and items); '' = automatic. */
	logo: async ({ request, locals, params }) => {
		const user = locals.user!;
		const booking = await getBookingFor(user, params.id);
		if (!booking) error(404, 'Buchung nicht gefunden.');
		if (!booking.payeeKey || !booking.canTag)
			return fail(400, {
				action: 'logo',
				message: 'Das Logo dieser Buchung darfst du nicht ändern.'
			});
		try {
			await setPayeeLogoFromForm(
				user,
				booking.payeeKey,
				booking.counterparty ?? 'Empfänger',
				await request.formData()
			);
		} catch (e) {
			if (e instanceof LogoError) return fail(400, { action: 'logo', message: e.message });
			throw e;
		}
		return { action: 'logo', success: true };
	},

	tags: async ({ request, locals, params }) => {
		const user = locals.user!;
		const { ids, error: invalid } = await readTagForm(user, await request.formData());
		if (invalid !== null) return fail(400, { action: 'tags', tagError: invalid });
		try {
			await setBookingTags(user, params.id, ids);
		} catch (e) {
			if (e instanceof TagError) return fail(400, { action: 'tags', tagError: e.message });
			throw e;
		}
		return { action: 'tags', success: true };
	},

	/** Split into categories; no rows = remove the split. */
	split: async ({ request, locals, params }) => {
		const user = locals.user!;
		const booking = await getBookingFor(user, params.id);
		if (!booking) error(404, 'Buchung nicht gefunden.');
		const data = await request.formData();
		const amounts = data.getAll('partAmount').map((v) => (typeof v === 'string' ? v : ''));
		const cats = data.getAll('partCategory').map((v) => (typeof v === 'string' ? v : ''));
		const inputs = amounts.map((amount, i) => ({ amount, categoryId: cats[i] ?? '' }));
		const { ctx } = await bookingFormContext(user);
		const result = validateSplit(booking.amount, inputs, ctx.categoryIds);
		if (!result.parts) return fail(400, { action: 'split', splitErrors: result.errors });
		try {
			await setSplit(user, params.id, result.parts);
		} catch (e) {
			if (e instanceof BookingError)
				return fail(400, { action: 'split', splitErrors: [e.message] });
			throw e;
		}
		return { action: 'split', success: true };
	},

	/** Category of an imported booking (remembered for the payee). */
	category: async ({ request, locals, params }) => {
		const categoryId = formString(await request.formData(), 'categoryId') || null;
		try {
			await setBookingCategory(locals.user!, params.id, categoryId);
		} catch (e) {
			if (e instanceof BookingError) return fail(400, { action: 'category', message: e.message });
			throw e;
		}
		return { action: 'category', success: true };
	},

	goalUndo: async ({ locals, params }) => {
		const user = locals.user!;
		if (!(await getBookingFor(user, params.id))) error(404, 'Buchung nicht gefunden.');
		const t = await goalTransferForBooking(user, params.id);
		try {
			await undoGoalTransfer(user, params.id);
		} catch (e) {
			if (e instanceof GoalError) return fail(400, { action: 'goalUndo', message: e.message });
			throw e;
		}
		redirect(303, t?.goalVisible && t.goalId ? `/sparziele/${t.goalId}` : '/buchungen');
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
