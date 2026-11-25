import { fail } from '@sveltejs/kit';
import {
	BudgetError,
	budgetAccounts,
	budgetsFor,
	deleteBudget,
	saveBudget,
	validateBudget
} from '#lib/server/budgets.js';
import { listCategories } from '#lib/server/categories.js';
import { buildTree } from '#lib/server/category-rules.js';
import { categoryGroups } from '#lib/server/recurring-form.js';
import { formString } from '#lib/server/validation.js';
import { monthProgress } from '#lib/budgets.js';
import { todayBerlin } from '#lib/dates.js';
import type { Actions, PageServerLoad } from './$types';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const today = todayBerlin();
	const asked = url.searchParams.get('monat');
	const month = asked && MONTH.test(asked) ? asked : today.slice(0, 7);
	const [rows, accounts, cats] = await Promise.all([
		budgetsFor(user, month),
		budgetAccounts(user),
		listCategories()
	]);
	return {
		month,
		thisMonth: today.slice(0, 7),
		pace: monthProgress(today, month),
		budgets: rows,
		accounts: [
			{ value: '', label: 'Alle Konten (nur für dich)' },
			...accounts.map((a) => ({ value: a.id, label: a.name }))
		],
		categoryGroups: categoryGroups(buildTree(cats))
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const user = locals.user!;
		const data = await request.formData();
		const id = formString(data, 'id') || null;
		const input = {
			categoryId: formString(data, 'categoryId'),
			accountId: formString(data, 'accountId'),
			amount: formString(data, 'amount')
		};
		const [cats, accounts] = await Promise.all([listCategories(), budgetAccounts(user)]);
		const { values, errors } = validateBudget(input, {
			categoryIds: new Set(cats.map((c) => c.id)),
			accountIds: new Set(accounts.map((a) => a.id))
		});
		if (!values) return fail(400, { action: 'save' as const, id, input, errors });
		try {
			await saveBudget(user, id, values);
		} catch (e) {
			if (e instanceof BudgetError)
				return fail(400, { action: 'save' as const, id, input, errors: { categoryId: e.message } });
			throw e;
		}
		return { action: 'save' as const, success: id ? 'Budget gesichert.' : 'Budget angelegt.' };
	},

	delete: async ({ request, locals }) => {
		try {
			await deleteBudget(locals.user!, formString(await request.formData(), 'id'));
		} catch (e) {
			if (e instanceof BudgetError)
				return fail(400, { action: 'delete' as const, message: e.message });
			throw e;
		}
		return { action: 'delete' as const, success: 'Budget gelöscht.' };
	}
};
