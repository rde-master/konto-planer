import { error, json } from '@sveltejs/kit';
import { PushError, subscribe, unsubscribe } from '#lib/server/push.js';
import type { RequestHandler } from './$types';

// Push subscriptions of the signed-in user's device (JSON from the browser, so no form CSRF).

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Nicht angemeldet.');
	const body: unknown = await request.json().catch(() => null);
	try {
		await subscribe(locals.user, body, request.headers.get('user-agent'));
	} catch (e) {
		if (e instanceof PushError) error(400, e.message);
		throw e;
	}
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Nicht angemeldet.');
	const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
	if (typeof body?.endpoint === 'string')
		await unsubscribe(locals.user, { endpoint: body.endpoint });
	return json({ ok: true });
};
