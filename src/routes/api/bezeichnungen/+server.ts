import { error, json } from '@sveltejs/kit';
import { setAltNames } from '#lib/server/alt-names.js';
import type { RequestHandler } from './$types';

// Switch "Alternative Bezeichnungen" on the pages with bookings: remembered per user.
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Nicht angemeldet.');
	const body: unknown = await request.json().catch(() => null);
	const on = (body as { on?: unknown } | null)?.on;
	if (typeof on !== 'boolean') error(400, 'Ungültige Anfrage.');
	await setAltNames(locals.user.id, on);
	return json({ ok: true, on });
};
