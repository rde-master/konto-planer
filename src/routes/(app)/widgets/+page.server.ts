import { fail } from '@sveltejs/kit';
import {
	WidgetError,
	createWidget,
	listWidgets,
	revokeWidget,
	widgetData
} from '#lib/server/widgets.js';
import { formString } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const [data, mine] = await Promise.all([widgetData(user, []), listWidgets(user.id)]);
	const names = new Map(data.accounts.map((a) => [a.id, a.name]));
	return {
		data,
		widgets: mine.map((w) => ({
			...w,
			accounts: w.accountIds.length ? w.accountIds.map((id) => names.get(id) ?? '–') : null
		}))
	};
};

export const actions: Actions = {
	create: async ({ request, locals, url }) => {
		const data = await request.formData();
		try {
			const { id, script } = await createWidget(
				locals.user!,
				{
					template: formString(data, 'template'),
					size: formString(data, 'size'),
					accountIds: data.getAll('account').filter((v): v is string => typeof v === 'string')
				},
				url.origin
			);
			return { created: { id, template: formString(data, 'template'), script } };
		} catch (e) {
			if (e instanceof WidgetError) return fail(400, { message: e.message });
			throw e;
		}
	},
	revoke: async ({ request, locals }) => {
		await revokeWidget(locals.user!, formString(await request.formData(), 'id'));
		return { success: 'Widget widerrufen; es zeigt keine neuen Werte mehr.' };
	}
};
