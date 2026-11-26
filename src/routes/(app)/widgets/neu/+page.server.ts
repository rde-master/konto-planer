import { fail } from '@sveltejs/kit';
import { WidgetError, createWidget, widgetData } from '#lib/server/widgets.js';
import { formString } from '#lib/server/validation.js';
import {
	DEFAULT_STYLE,
	TEMPLATE_INFO,
	TEMPLATE_LAYOUTS,
	WIDGET_TEMPLATES,
	type WidgetLayout
} from '#lib/widgets.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const template = WIDGET_TEMPLATES.find((t) => t === url.searchParams.get('vorlage'));
	const layout: WidgetLayout = {
		items: template
			? TEMPLATE_LAYOUTS[template]
			: [{ kind: 'title', text: '' }, { kind: 'available' }],
		style: DEFAULT_STYLE
	};
	return {
		data: await widgetData(locals.user!, []),
		initial: {
			name: template ? TEMPLATE_INFO[template].title : 'Eigenes Widget',
			size:
				template === 'payments' || template === 'accounts'
					? ('medium' as const)
					: ('small' as const),
			accountIds: [] as string[],
			layout
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const data = await request.formData();
		let layout: unknown;
		try {
			layout = JSON.parse(formString(data, 'layout'));
		} catch {
			return fail(400, { message: 'Das Layout ist ungültig.' });
		}
		try {
			const { id, script } = await createWidget(
				locals.user!,
				{
					template: 'custom',
					size: formString(data, 'size'),
					name: formString(data, 'name'),
					accountIds: data.getAll('account').filter((v): v is string => typeof v === 'string'),
					layout
				},
				url.origin
			);
			return { created: { id, script } };
		} catch (e) {
			if (e instanceof WidgetError) return fail(400, { message: e.message });
			throw e;
		}
	}
};
