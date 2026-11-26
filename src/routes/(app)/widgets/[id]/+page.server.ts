import { error, fail, redirect } from '@sveltejs/kit';
import {
	WidgetError,
	getWidget,
	layoutOf,
	renewScript,
	revokeWidget,
	saveWidget,
	widgetData
} from '#lib/server/widgets.js';
import { formString } from '#lib/server/validation.js';
import type { WidgetSize } from '#lib/widgets.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const widget = await getWidget(locals.user!.id, params.id);
	if (!widget) error(404, 'Widget nicht gefunden.');
	return {
		id: widget.id,
		lastUsedAt: widget.lastUsedAt,
		data: await widgetData(locals.user!, []),
		initial: {
			name: widget.name,
			size: widget.size as WidgetSize,
			accountIds: widget.accountIds,
			layout: layoutOf(widget)
		}
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		const data = await request.formData();
		try {
			await saveWidget(locals.user!, params.id, {
				name: formString(data, 'name'),
				size: formString(data, 'size'),
				accountIds: data.getAll('account').filter((v): v is string => typeof v === 'string'),
				layout: JSON.parse(formString(data, 'layout') || 'null') as unknown
			});
		} catch (e) {
			if (e instanceof WidgetError || e instanceof SyntaxError)
				return fail(400, {
					message: e instanceof WidgetError ? e.message : 'Das Layout ist ungültig.'
				});
			throw e;
		}
		return { success: 'Gesichert – das iPhone zeigt die Änderung beim nächsten Aktualisieren.' };
	},
	renew: async ({ locals, params, url }) => {
		try {
			return { script: await renewScript(locals.user!, params.id, url.origin) };
		} catch (e) {
			if (e instanceof WidgetError) return fail(400, { message: e.message });
			throw e;
		}
	},
	revoke: async ({ locals, params }) => {
		await revokeWidget(locals.user!, params.id);
		redirect(303, '/widgets');
	}
};
