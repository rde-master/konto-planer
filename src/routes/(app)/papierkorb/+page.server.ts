import { fail } from '@sveltejs/kit';
import { TrashError, listTrash, purgeTrash, restoreFromTrash } from '#lib/server/trash.js';
import { syncDues } from '#lib/server/due.js';
import { syncInterest } from '#lib/server/interest.js';
import { formString } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	items: await listTrash(locals.user!),
	isAdmin: locals.user!.role === 'admin'
});

export const actions: Actions = {
	restore: async ({ request, locals }) => {
		const id = formString(await request.formData(), 'id');
		let entry;
		try {
			entry = await restoreFromTrash(locals.user!, id);
		} catch (e) {
			if (e instanceof TrashError) return fail(400, { message: e.message });
			throw e;
		}
		// Due items of a restored item, interest of a restored booking's account.
		if (entry.entityType === 'recurring') await syncDues([entry.entityId]);
		if (entry.entityType === 'booking' && entry.accountId) await syncInterest([entry.accountId]);
		return { restored: entry.label };
	},

	purge: async ({ request, locals }) => {
		const id = formString(await request.formData(), 'id');
		try {
			await purgeTrash(locals.user!, id || undefined);
		} catch (e) {
			if (e instanceof TrashError) return fail(400, { message: e.message });
			throw e;
		}
		return { purged: true };
	}
};
