import { error, json } from '@sveltejs/kit';
import { tokenAuth } from '#lib/server/api.js';
import { ShortcutError, bookFromShortcut, optionsFor } from '#lib/server/shortcut.js';
import type { RequestHandler } from './$types';

// iOS shortcut: GET = choices for "Aus Liste wählen", POST = book. Only shortcut tokens.
async function auth(request: Request) {
	const a = await tokenAuth(request);
	if (!a) error(401, 'Ungültiges oder fehlendes Token.');
	if (a.purpose !== 'shortcut') error(403, 'Dieser Zugang darf nicht buchen.');
	return a;
}

export const GET: RequestHandler = async ({ request }) => {
	const a = await auth(request);
	const options = (await optionsFor(a.viewer)).map((o) => o.label);
	return json({ options }, { headers: { 'cache-control': 'no-store' } });
};

export const POST: RequestHandler = async ({ request }) => {
	const a = await auth(request);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body) error(400, 'Bitte JSON mit amount und choice senden.');
	try {
		const message = await bookFromShortcut({ ...a.viewer, name: a.name }, a.defaultAccountId, body);
		return json({ ok: true, message });
	} catch (e) {
		if (e instanceof ShortcutError) return json({ ok: false, message: e.message }, { status: 400 });
		throw e;
	}
};
