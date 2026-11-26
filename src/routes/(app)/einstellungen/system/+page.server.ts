import { fail } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guards.js';
import { createBackup, latestRelease, systemStatus } from '#lib/server/system.js';
import { syncWebLogos, webLogosEnabled } from '#lib/server/web-logos.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals.user);
	return { status: await systemStatus(), webLogos: webLogosEnabled() };
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
	logos: async ({ locals }) => {
		requireAdmin(locals.user);
		if (!webLogosEnabled())
			return fail(400, { message: 'Logos aus dem Web sind abgeschaltet (WEB_LOGOS=false).' });
		const n = await syncWebLogos({ budgetMs: 90_000 });
		return {
			success:
				n === 0
					? 'Keine neuen Logos gefunden.'
					: n === 1
						? 'Ein neues Logo gefunden.'
						: `${n} neue Logos gefunden.`
		};
	},
	update: async ({ locals }) => {
		requireAdmin(locals.user);
		const r = await latestRelease(true);
		return {
			success: r ? `Neueste Version auf GitHub: ${r.latest}.` : 'GitHub war nicht erreichbar.'
		};
	}
};
