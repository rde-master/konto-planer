import { error, fail, redirect } from '@sveltejs/kit';
import {
	ImportError,
	createDraft,
	importableAccount,
	recentImports,
	undoImport,
	undoableImportId
} from '#lib/server/imports.js';
import { formString } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const ctx = await importableAccount(locals.user!, params.id);
	if (!ctx) error(404, 'Konto nicht gefunden.');
	return {
		account: { id: ctx.account.id, name: ctx.account.name, iban: ctx.account.iban },
		reason: ctx.reason,
		recent: await recentImports(ctx.account.id),
		undoable: ctx.reason ? null : await undoableImportId(ctx.account.id)
	};
};

export const actions: Actions = {
	upload: async ({ request, locals, params }) => {
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0)
			return fail(400, { message: 'Bitte eine CSV-Datei wählen.' });
		let id: string;
		try {
			id = await createDraft(locals.user!, params.id, file);
		} catch (e) {
			if (e instanceof ImportError) return fail(400, { message: e.message });
			throw e;
		}
		redirect(303, `/konten/${params.id}/import/${id}`);
	},

	/** "Import rückgängig": only the latest import of the account. */
	undo: async ({ request, locals, params }) => {
		try {
			await undoImport(locals.user!, params.id, formString(await request.formData(), 'importId'));
		} catch (e) {
			if (e instanceof ImportError) return fail(400, { message: e.message });
			throw e;
		}
		return { undone: true };
	}
};
