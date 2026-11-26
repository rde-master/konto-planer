import { error, json } from '@sveltejs/kit';
import { widgetResponse } from '#lib/server/widgets.js';
import type { RequestHandler } from './$types';

// Scriptable widgets: layout blocks and values for one widget token.
export const GET: RequestHandler = async ({ request }) => {
	const body = await widgetResponse(request);
	if (!body) error(401, 'Ungültiges oder widerrufenes Widget.');
	return json(body, { headers: { 'cache-control': 'no-store' } });
};
