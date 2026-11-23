import { fail } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guards.js';
import {
	CategoryError,
	createCategory,
	createDefaultCategories,
	deleteCategory,
	listCategories,
	updateCategory
} from '#lib/server/categories.js';
import { buildTree, validateCategory, type CategoryInput } from '#lib/server/category-rules.js';
import { fieldError, formString } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { tree: buildTree(await listCategories()), isAdmin: locals.user!.role === 'admin' };
};

function readForm(data: FormData): CategoryInput {
	return {
		name: formString(data, 'name'),
		parentId: formString(data, 'parentId'),
		color: formString(data, 'color')
	};
}

export const actions: Actions = {
	// Every signed-in user may create and change categories; only admins delete them.
	create: async ({ request, locals }) => {
		const input = readForm(await request.formData());
		const { values, errors } = validateCategory(input, await listCategories());
		if (!values) return fail(400, { action: 'create', input, errors });
		try {
			await createCategory(locals.user!, values);
		} catch (e) {
			if (e instanceof CategoryError)
				return fail(400, { action: 'create', input, errors: fieldError('name', e.message) });
			throw e;
		}
		return { action: 'create', saved: values.name };
	},

	update: async ({ request, locals }) => {
		const data = await request.formData();
		const id = formString(data, 'id');
		const input = readForm(data);
		const existing = await listCategories();
		if (!existing.some((c) => c.id === id))
			return fail(404, {
				action: 'update',
				id,
				input,
				errors: fieldError('name', 'Kategorie nicht gefunden.')
			});
		const { values, errors } = validateCategory(input, existing, id);
		if (!values) return fail(400, { action: 'update', id, input, errors });
		try {
			await updateCategory(locals.user!, id, values);
		} catch (e) {
			if (e instanceof CategoryError)
				return fail(400, { action: 'update', id, input, errors: fieldError('name', e.message) });
			throw e;
		}
		return { action: 'update', saved: values.name };
	},

	delete: async ({ request, locals }) => {
		const actor = requireAdmin(locals.user);
		const id = formString(await request.formData(), 'id');
		try {
			return { action: 'delete', deleted: await deleteCategory(actor, id) };
		} catch (e) {
			if (e instanceof CategoryError) return fail(400, { action: 'delete', message: e.message });
			throw e;
		}
	},

	defaults: async ({ locals }) => {
		try {
			return { action: 'defaults', count: await createDefaultCategories(locals.user!) };
		} catch (e) {
			if (e instanceof CategoryError) return fail(400, { action: 'defaults', message: e.message });
			throw e;
		}
	}
};
