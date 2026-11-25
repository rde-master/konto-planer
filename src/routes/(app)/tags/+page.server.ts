import { fail } from '@sveltejs/kit';
import { TagError, createTag, listTags, tagCounts } from '#lib/server/tags.js';
import { formString } from '#lib/server/validation.js';
import { validateTagName } from '#lib/tags.js';
import { todayBerlin } from '#lib/dates.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const year = Number(todayBerlin().slice(0, 4));
	const [all, counts] = await Promise.all([listTags(), tagCounts(locals.user!, year)]);
	return {
		year,
		tags: all.map((t) => ({ id: t.id, name: t.name, count: counts.get(t.id) ?? 0 }))
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const input = formString(await request.formData(), 'name');
		const { name, error } = validateTagName(input);
		if (error !== null) return fail(400, { input, error });
		try {
			await createTag(locals.user!, name);
		} catch (e) {
			if (e instanceof TagError) return fail(400, { input, error: e.message });
			throw e;
		}
		return { created: name };
	}
};
