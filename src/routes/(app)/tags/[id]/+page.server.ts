import { error, fail, redirect } from '@sveltejs/kit';
import { TagError, deleteTag, getTag, itemsWithTag, renameTag, tagYear } from '#lib/server/tags.js';
import { formString } from '#lib/server/validation.js';
import { validateTagName } from '#lib/tags.js';
import { todayBerlin } from '#lib/dates.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const tag = await getTag(params.id);
	if (!tag) error(404, 'Tag nicht gefunden.');
	const current = Number(todayBerlin().slice(0, 4));
	const asked = Number(url.searchParams.get('jahr'));
	const year = Number.isInteger(asked) && asked > 1990 && asked < 2200 ? asked : current;
	const [summary, items] = await Promise.all([
		tagYear(locals.user!, tag.id, year),
		itemsWithTag(locals.user!, tag.id)
	]);
	const years = [...new Set([current, year, ...summary.years])].sort((a, b) => b - a);
	return { tag, summary: { ...summary, years }, items, isAdmin: locals.user!.role === 'admin' };
};

export const actions: Actions = {
	rename: async ({ request, locals, params }) => {
		const input = formString(await request.formData(), 'name');
		const { name, error: invalid } = validateTagName(input);
		if (invalid !== null) return fail(400, { action: 'rename' as const, input, error: invalid });
		try {
			await renameTag(locals.user!, params.id, name);
		} catch (e) {
			if (e instanceof TagError)
				return fail(400, { action: 'rename' as const, input, error: e.message });
			throw e;
		}
		return { action: 'rename' as const, success: true };
	},

	delete: async ({ locals, params }) => {
		try {
			await deleteTag(locals.user!, params.id);
		} catch (e) {
			if (e instanceof TagError) return fail(400, { action: 'delete' as const, error: e.message });
			throw e;
		}
		redirect(303, '/tags');
	}
};
