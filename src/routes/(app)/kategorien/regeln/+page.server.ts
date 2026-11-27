import { fail } from '@sveltejs/kit';
import {
	RuleError,
	applicableCount,
	applyRules,
	createRule,
	deleteRule,
	listRules,
	moveRule,
	updateRule
} from '#lib/server/rules.js';
import { validateRule } from '#lib/server/rule-rules.js';
import { listCategories } from '#lib/server/categories.js';
import { buildTree } from '#lib/server/category-rules.js';
import { categoryGroups } from '#lib/server/recurring-form.js';
import { fieldError, formString } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const [rules, categories, applicable] = await Promise.all([
		listRules(),
		listCategories(),
		applicableCount(user)
	]);
	return {
		rules,
		categoryGroups: categoryGroups(buildTree(categories)),
		applicable,
		isAdmin: user.role === 'admin'
	};
};

function readInput(data: FormData) {
	const all = (name: string) => data.getAll(name).map((v) => (typeof v === 'string' ? v : ''));
	const operators = all('moreOperator');
	const values = all('moreValue');
	return {
		field: formString(data, 'field'),
		operator: formString(data, 'operator'),
		value: formString(data, 'value'),
		categoryId: formString(data, 'categoryId'),
		// Further conditions: all of them must hold as well.
		more: all('moreField').map((field, i) => ({
			field,
			operator: operators[i] ?? '',
			value: values[i] ?? ''
		}))
	};
}

async function categoryIds() {
	return new Set((await listCategories()).map((c) => c.id));
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const data = await request.formData();
		const id = formString(data, 'id');
		const input = readInput(data);
		const { values, errors } = validateRule(input, { categoryIds: await categoryIds() });
		if (!values) return fail(400, { action: 'save' as const, id, input, errors });
		try {
			if (id) await updateRule(locals.user!, id, values);
			else await createRule(locals.user!, values);
		} catch (e) {
			if (e instanceof RuleError)
				return fail(400, {
					action: 'save' as const,
					id,
					input,
					errors: fieldError('value', e.message)
				});
			throw e;
		}
		return { action: 'save' as const, success: id ? 'Regel gesichert.' : 'Regel angelegt.' };
	},

	delete: async ({ request, locals }) => {
		try {
			await deleteRule(locals.user!, formString(await request.formData(), 'id'));
		} catch (e) {
			if (e instanceof RuleError)
				return fail(400, { action: 'delete' as const, message: e.message });
			throw e;
		}
		return { action: 'delete' as const, success: 'Regel gelöscht.' };
	},

	move: async ({ request, locals }) => {
		const data = await request.formData();
		const direction = formString(data, 'direction') === 'up' ? 'up' : 'down';
		try {
			await moveRule(locals.user!, formString(data, 'id'), direction);
		} catch (e) {
			if (e instanceof RuleError) return fail(400, { action: 'move' as const, message: e.message });
			throw e;
		}
		return { action: 'move' as const };
	},

	apply: async ({ locals }) => {
		const n = await applyRules(locals.user!);
		return {
			action: 'apply' as const,
			success:
				n === 1
					? 'Eine Buchung hat eine Kategorie bekommen.'
					: `${n} Buchungen haben eine Kategorie bekommen.`
		};
	}
};
