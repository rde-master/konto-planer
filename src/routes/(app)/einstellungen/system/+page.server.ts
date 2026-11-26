import { fail } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guards.js';
import { createBackup, latestRelease, systemStatus } from '#lib/server/system.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals.user);
	return { status: await systemStatus() };
};

export const actions: Actions = {
	backup: async ({ locals }) => {
		const user = requireAdmin(locals.user);
		try {
			const name = await createBackup(user);
			return { success: `Sicherung ${name} erstellt.` };
		} catch (e) {
			return fail(500, {
				message: `Sicherung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`
			});
		}
	},
	update: async ({ locals }) => {
		requireAdmin(locals.user);
		const r = await latestRelease(true);
		return {
			success: r ? `Neueste Version auf GitHub: ${r.latest}.` : 'GitHub war nicht erreichbar.'
		};
	}
};
