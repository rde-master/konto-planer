import { json } from '@sveltejs/kit';
import { ShortcutError, importFromShortcut, shortcutAuth } from '#lib/server/shortcut.js';
import { shortcutFile } from '#lib/shortcut.js';
import type { RequestHandler } from './$types';

// iOS shortcut: bank export. JSON `{ "file": "<Base64 or the CSV text>" }` – the reliable way,
// whatever iOS calls the file – or the file itself as the body (text/csv or
// application/octet-stream; SvelteKit refuses text/plain and form bodies without an Origin).
// `?vorschau=1` only stores the draft for the preview in the app.
export const POST: RequestHandler = async ({ request, url }) => {
	const a = await shortcutAuth(request);
	const reply = (ok: boolean, message: string, path?: string) =>
		json(
			{ ok, message, ...(path ? { url: `${url.origin}/${path}` } : {}) },
			{ status: ok ? 200 : 400, headers: { 'cache-control': 'no-store' } }
		);
	const type = (request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
	let bytes: Uint8Array | null;
	let name: string | null = null;
	let preview = ['1', 'true', 'ja'].includes(url.searchParams.get('vorschau') ?? '');
	if (type === 'application/json') {
		const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
		bytes = shortcutFile(body?.file);
		if (typeof body?.name === 'string') name = body.name;
		if (body?.preview === true) preview = true;
		if (!bytes)
			return reply(false, 'Bitte die Datei Base64-codiert im Feld „file“ senden (höchstens 5 MB).');
	} else bytes = new Uint8Array(await request.arrayBuffer());
	try {
		const result = await importFromShortcut(
			{ ...a.viewer, name: a.name },
			a.defaultAccountId,
			{ bytes, name },
			preview
		);
		return reply(true, result.message, result.path);
	} catch (e) {
		if (e instanceof ShortcutError) return reply(false, e.message);
		throw e;
	}
};
