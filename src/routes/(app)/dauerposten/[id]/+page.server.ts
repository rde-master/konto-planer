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
import { dueDates } from '#lib/recurring.js';
import { todayBerlin } from '#lib/dates.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = locals.user!;
	const item = await getRecurringFor(user, params.id);
	if (!item) error(404, 'Dauerposten nicht gefunden.');
	const [{ options }, settings, attachments] = await Promise.all([
		recurringFormContext(user, item),
		getSettings(),
		listAttachments(item.id)
	]);
	const today = todayBerlin();
	return {
		item,
		defaultLeadDays: settings.defaultLeadDays,
		attachments,
		...options,
		upcoming: item.archivedAt ? [] : dueDates(item, today, '9999-12-31', 6),
		today,
		hasData: await recurringHasData(item.id)
	};
};

function recurringError(action: string, e: unknown) {
	if (e instanceof RecurringError) return fail(400, { action, message: e.message });
	throw e;
}

export const actions: Actions = {
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

	delete: async ({ locals, params }) => {
		// Files are removed after the rows (cascade) are gone.
		const files = await attachmentIdsOf([params.id]);
		try {
			await deleteRecurring(locals.user!, params.id);
		} catch (e) {
			return recurringError('delete', e);
		}
		await removeAttachmentFiles(files);
		redirect(303, '/dauerposten');
	}
};
