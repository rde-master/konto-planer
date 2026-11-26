import { cleanKinds, createFeed, deleteFeed, feedOf, setFeedKinds } from '#lib/server/calendar.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { feed: await feedOf(locals.user!.id) };
};

const chosen = (data: FormData) =>
	cleanKinds(data.getAll('include').filter((v): v is string => typeof v === 'string'));

export const actions: Actions = {
	create: async ({ request, locals, url }) => {
		const include = chosen(await request.formData());
		const token = await createFeed(locals.user!, include);
		const link = `${url.origin}/api/kalender/${token}.ics`;
		return { success: 'Neuer Abo-Link erzeugt.', link };
	},
	save: async ({ request, locals }) => {
		await setFeedKinds(locals.user!, chosen(await request.formData()));
		return { success: 'Kalender-Inhalt gesichert.' };
	},
	delete: async ({ locals }) => {
		await deleteFeed(locals.user!);
		return { success: 'Kalender-Abo beendet; der Link funktioniert nicht mehr.' };
	}
};
