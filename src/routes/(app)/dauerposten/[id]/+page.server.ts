import { error, fail, redirect } from '@sveltejs/kit';
import {
	RecurringError,
	addAmount,
	deleteAmount,
	deleteRecurring,
	endPause,
	getRecurringFor,
	recurringHasData,
	setPause,
	setRecurringArchived,
	updateAmount,
	updateRecurring
} from '#lib/server/recurring.js';
import { listGoalsFor } from '#lib/server/goals.js';
import { TagError, listTags, readTagForm, setRecurringTags, tagsOf } from '#lib/server/tags.js';
import { db } from '#lib/server/db/index.js';
import {
	addExtra,
	applyLoanEnd,
	deleteExtra,
	deleteLoan,
	loanInfo,
	saveLoan,
	validateExtra,
	validateLoan
} from '#lib/server/loans.js';
import {
	validateAmount,
	validateContract,
	validatePause,
	validateRecurring
} from '#lib/server/recurring-rules.js';
import {
	readContractForm,
	readRecurringForm,
	recurringFormContext
} from '#lib/server/recurring-form.js';
import { getSettings } from '#lib/server/settings.js';
import {
	addAttachment,
	attachmentIdsOf,
	deleteAttachment,
	listAttachments,
	removeAttachmentFiles
} from '#lib/server/attachments.js';
import { fieldError, formString } from '#lib/server/validation.js';
import { addDays, addMonths } from '#lib/recurring.js';
import { duesBetween } from '#lib/due.js';
import { DueError, recentDues, restoreDue } from '#lib/server/due.js';
import { todayBerlin } from '#lib/dates.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = locals.user!;
	const item = await getRecurringFor(user, params.id);
	if (!item) error(404, 'Dauerposten nicht gefunden.');
	const [{ options }, settings, attachments, recent] = await Promise.all([
		recurringFormContext(user, item),
		getSettings(),
		listAttachments(item.id),
		recentDues(item.id)
	]);
	const today = todayBerlin();
	// Due items after today (today's are booked provisionally), shifted to bank days.
	const upcoming = item.archivedAt
		? []
		: duesBetween(item, item.amounts, addDays(today, 1), addMonths(today, 60)).slice(0, 6);
	// Viewers of the receiving account only see its side of a transfer.
	const ownSide = item.account.level !== null;
	const goals =
		item.kind === 'expense' ? await listGoalsFor(locals.user!, { recurringId: item.id }) : [];
	const loan = item.kind === 'expense' ? await loanInfo(item) : null;
	const [tagMap, allTags] = await Promise.all([tagsOf(db, [], [item.id]), listTags()]);
	return {
		item,
		goals,
		loan,
		tags: {
			all: allTags.map((t) => ({ id: t.id, name: t.name })),
			selected: tagMap.recurring.get(item.id) ?? []
		},
		defaultLeadDays: settings.defaultLeadDays,
		attachments,
		...options,
		upcoming,
		recent: recent.map((d) => ({
			id: d.id,
			dueDate: d.dueDate,
			bookingDate: d.bookingDate,
			amount: d.amount,
			status: d.status,
			bookingId: ownSide ? d.bookingId : d.targetBookingId
		})),
		today,
		hasData: await recurringHasData(item.id)
	};
};

function recurringError(action: string, e: unknown) {
	if (e instanceof RecurringError) return fail(400, { action, message: e.message });
	throw e;
}

export const actions: Actions = {
	/** Books a skipped ("zurückgenommen") due item provisionally again. */
	restoreDue: async ({ request, locals }) => {
		try {
			await restoreDue(locals.user!, formString(await request.formData(), 'dueId'));
		} catch (e) {
			if (e instanceof DueError) return fail(400, { action: 'restoreDue', message: e.message });
			throw e;
		}
		return { action: 'restoreDue', success: true };
	},

	update: async ({ request, locals, params }) => {
		const user = locals.user!;
		const data = await request.formData();
		const input = { ...readRecurringForm(data), ...readContractForm(data) };
		const item = await getRecurringFor(user, params.id);
		if (!item) error(404, 'Dauerposten nicht gefunden.');
		const { ctx } = await recurringFormContext(user, item);
		const { values, errors } = validateRecurring(input, ctx);
		const contract = validateContract(input, input.kind);
		if (!values || contract.errors)
			return fail(400, {
				action: 'update',
				input,
				errors: { ...(errors ?? {}), ...(contract.errors ?? {}) }
			});
		try {
			await updateRecurring(user, params.id, values, contract.values);
		} catch (e) {
			return recurringError('update', e);
		}
		return { action: 'update', success: true };
	},

	amountAdd: async ({ request, locals, params }) => {
		const data = await request.formData();
		const input = { amount: formString(data, 'amount'), validFrom: formString(data, 'validFrom') };
		const { values, errors } = validateAmount(input);
		if (!values) return fail(400, { action: 'amount', amountInput: input, errors });
		try {
			await addAmount(locals.user!, params.id, values);
		} catch (e) {
			if (e instanceof RecurringError)
				return fail(400, {
					action: 'amount',
					amountInput: input,
					errors: fieldError('validFrom', e.message)
				});
			throw e;
		}
		return { action: 'amount', success: true };
	},

	amountUpdate: async ({ request, locals, params }) => {
		const data = await request.formData();
		const amountId = formString(data, 'amountId');
		const input = { amount: formString(data, 'amount'), validFrom: formString(data, 'validFrom') };
		const { values, errors } = validateAmount(input);
		if (!values) return fail(400, { action: 'amount', amountId, amountInput: input, errors });
		try {
			await updateAmount(locals.user!, params.id, amountId, values);
		} catch (e) {
			if (e instanceof RecurringError)
				return fail(400, {
					action: 'amount',
					amountId,
					amountInput: input,
					errors: fieldError('validFrom', e.message)
				});
			throw e;
		}
		return { action: 'amount', success: true };
	},

	amountDelete: async ({ request, locals, params }) => {
		const amountId = formString(await request.formData(), 'amountId');
		try {
			await deleteAmount(locals.user!, params.id, amountId);
		} catch (e) {
			return recurringError('amountDelete', e);
		}
		return { action: 'amountDelete', success: true };
	},

	pause: async ({ request, locals, params }) => {
		const data = await request.formData();
		const input = {
			pauseFrom: formString(data, 'pauseFrom'),
			pauseUntil: formString(data, 'pauseUntil')
		};
		const { values, errors } = validatePause(input);
		if (!values) return fail(400, { action: 'pause', pauseInput: input, errors });
		try {
			await setPause(locals.user!, params.id, values);
		} catch (e) {
			return recurringError('pause', e);
		}
		return { action: 'pause', success: true };
	},

	tags: async ({ request, locals, params }) => {
		const user = locals.user!;
		const { ids, error: invalid } = await readTagForm(user, await request.formData());
		if (invalid !== null) return fail(400, { action: 'tags', tagError: invalid });
		try {
			await setRecurringTags(user, params.id, ids);
		} catch (e) {
			if (e instanceof TagError) return fail(400, { action: 'tags', tagError: e.message });
			throw e;
		}
		return { action: 'tags', success: true };
	},

	loan: async ({ request, locals, params }) => {
		const data = await request.formData();
		const loanInput = {
			principal: formString(data, 'principal'),
			rate: formString(data, 'rate'),
			startDate: formString(data, 'startDate'),
			termEnd: formString(data, 'termEnd')
		};
		const { values, errors } = validateLoan(loanInput);
		if (!values) return fail(400, { action: 'loan', loanInput, errors });
		try {
			await saveLoan(locals.user!, params.id, values);
		} catch (e) {
			return recurringError('loan', e);
		}
		return { action: 'loan', success: true };
	},

	loanDelete: async ({ locals, params }) => {
		try {
			await deleteLoan(locals.user!, params.id);
		} catch (e) {
			return recurringError('loanDelete', e);
		}
		return { action: 'loanDelete', success: true };
	},

	extra: async ({ request, locals, params }) => {
		const data = await request.formData();
		const extraInput = { date: formString(data, 'date'), amount: formString(data, 'amount') };
		const { values, errors } = validateExtra(extraInput);
		if (!values) return fail(400, { action: 'extra', extraInput, errors });
		try {
			await addExtra(locals.user!, params.id, values);
		} catch (e) {
			if (e instanceof RecurringError)
				return fail(400, {
					action: 'extra',
					extraInput,
					errors: fieldError('date', e.message)
				});
			throw e;
		}
		return { action: 'extra', success: true };
	},

	extraDelete: async ({ request, locals, params }) => {
		try {
			await deleteExtra(locals.user!, params.id, formString(await request.formData(), 'extraId'));
		} catch (e) {
			return recurringError('extraDelete', e);
		}
		return { action: 'extraDelete', success: true };
	},

	loanEnd: async ({ locals, params }) => {
		try {
			await applyLoanEnd(locals.user!, params.id);
		} catch (e) {
			return recurringError('loanEnd', e);
		}
		return { action: 'loanEnd', success: true };
	},

	pauseEnd: async ({ locals, params }) => {
		try {
			await endPause(locals.user!, params.id);
		} catch (e) {
			return recurringError('pauseEnd', e);
		}
		return { action: 'pauseEnd', success: true };
	},

	archive: async ({ locals, params }) => {
		try {
			await setRecurringArchived(locals.user!, params.id, true);
		} catch (e) {
			return recurringError('archive', e);
		}
		return { action: 'archive', success: true };
	},

	restore: async ({ locals, params }) => {
		try {
			await setRecurringArchived(locals.user!, params.id, false);
		} catch (e) {
			return recurringError('restore', e);
		}
		return { action: 'restore', success: true };
	},

	attachmentAdd: async ({ request, locals, params }) => {
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0)
			return fail(400, { action: 'attachment', message: 'Bitte eine PDF-Datei wählen.' });
		try {
			await addAttachment(locals.user!, params.id, file);
		} catch (e) {
			return recurringError('attachment', e);
		}
		return { action: 'attachmentAdd', success: true };
	},

	attachmentDelete: async ({ request, locals, params }) => {
		const attachmentId = formString(await request.formData(), 'attachmentId');
		try {
			await deleteAttachment(locals.user!, params.id, attachmentId);
		} catch (e) {
			return recurringError('attachment', e);
		}
		return { action: 'attachmentDelete', success: true };
	},

	delete: async ({ request, locals, params }) => {
		const once = formString(await request.formData(), 'once') === 'on';
		// Files are removed after the rows (cascade) are gone.
		const files = await attachmentIdsOf([params.id]);
		try {
			await deleteRecurring(locals.user!, params.id);
		} catch (e) {
			return recurringError('delete', e);
		}
		await removeAttachmentFiles(files);
		redirect(303, once ? '/geplant' : '/dauerposten');
	}
};
