import { error, fail, redirect } from '@sveltejs/kit';
import { ImportError, commitImport, discardDraft, importView } from '#lib/server/imports.js';
import { BookingError, adjustBalance, balanceOf } from '#lib/server/bookings.js';
import { getAccountFor } from '#lib/server/accounts.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const view = await importView(locals.user!, params.id, params.importId);
	if (!view) error(404, 'Import nicht gefunden.');
	const account = await getAccountFor(locals.user!, params.id);
	// The app's balance on the check day as it is now (it changes after an adjustment).
	const appBalance =
		account && view.status === 'done' && view.checkDate
			? await balanceOf(account, view.checkDate)
			: null;
	return { view, appBalance };
};

export const actions: Actions = {
	commit: async ({ request, locals, params }) => {
		const data = await request.formData();
		const selected = new Set(
			data
				.getAll('line')
				.map((v) => Number(v))
				.filter((n) => Number.isInteger(n))
		);
		try {
			await commitImport(locals.user!, params.id, params.importId, selected);
		} catch (e) {
			if (e instanceof ImportError) return fail(400, { message: e.message });
			throw e;
		}
		return { done: true };
	},

	discard: async ({ locals, params }) => {
		await discardDraft(locals.user!, params.id, params.importId);
		redirect(303, `/konten/${params.id}/import`);
	},

	/** Books the difference to the bank's balance as an adjustment. */
	adjust: async ({ locals, params }) => {
		const view = await importView(locals.user!, params.id, params.importId);
		if (!view) error(404, 'Import nicht gefunden.');
		if (view.status !== 'done' || !view.checkDate || view.bankBalance === null)
			return fail(400, { message: 'Für diesen Import gibt es keinen Saldo zum Abgleich.' });
		try {
			await adjustBalance(locals.user!, params.id, {
				date: view.checkDate,
				actual: view.bankBalance
			});
		} catch (e) {
			if (e instanceof BookingError) return fail(400, { message: e.message });
			throw e;
		}
		return { adjusted: true };
	}
};
