import { fail } from '@sveltejs/kit';
import {
	TemplateError,
	createTemplate,
	deleteTemplate,
	getTemplateFor,
	listTemplatesFor,
	moveTemplate,
	updateTemplate
} from '#lib/server/templates.js';
import { validateTemplate } from '#lib/server/template-rules.js';
import { readTemplateForm, templateFormContext } from '#lib/server/template-form.js';
import { fieldError, formString } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const [templates, { options }] = await Promise.all([
		listTemplatesFor(user),
		templateFormContext(user)
	]);
	return {
		templates,
		accounts: options.bookingAccounts,
		categoryGroups: options.categoryGroups,
		isAdmin: user.role === 'admin'
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const user = locals.user!;
		const input = readTemplateForm(await request.formData());
		const { ctx } = await templateFormContext(user);
		const { values, errors } = validateTemplate(input, ctx);
		if (!values) return fail(400, { action: 'create', input, errors });
		try {
			await createTemplate(user, values);
		} catch (e) {
			if (e instanceof TemplateError)
				return fail(400, { action: 'create', input, errors: fieldError('name', e.message) });
			throw e;
		}
		return { action: 'create', saved: values.name };
	},

	update: async ({ request, locals }) => {
		const user = locals.user!;
		const data = await request.formData();
		const id = formString(data, 'id');
		const input = readTemplateForm(data);
		const current = await getTemplateFor(user, id);
		if (!current)
			return fail(404, {
				action: 'update',
				id,
				input,
				errors: fieldError('name', 'Vorlage nicht gefunden.')
			});
		const { ctx } = await templateFormContext(user);
		const { values, errors } = validateTemplate(input, {
			...ctx,
			currentAccountId: current.accountId
		});
		if (!values) return fail(400, { action: 'update', id, input, errors });
		try {
			await updateTemplate(user, id, values);
		} catch (e) {
			if (e instanceof TemplateError)
				return fail(400, { action: 'update', id, input, errors: fieldError('name', e.message) });
			throw e;
		}
		return { action: 'update', saved: values.name };
	},

	delete: async ({ request, locals }) => {
		const id = formString(await request.formData(), 'id');
		try {
			return { action: 'delete', deleted: await deleteTemplate(locals.user!, id) };
		} catch (e) {
			if (e instanceof TemplateError) return fail(400, { action: 'delete', message: e.message });
			throw e;
		}
	},

	move: async ({ request, locals }) => {
		const data = await request.formData();
		const direction = formString(data, 'direction');
		if (direction !== 'up' && direction !== 'down') return fail(400, { action: 'move' });
		try {
			await moveTemplate(locals.user!, formString(data, 'id'), direction);
		} catch (e) {
			if (e instanceof TemplateError) return fail(400, { action: 'move', message: e.message });
			throw e;
		}
		return { action: 'move' };
	}
};
