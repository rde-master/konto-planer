import { error } from '@sveltejs/kit';
import { readIcon } from '#lib/server/web-logos.js';
import type { RequestHandler } from './$types';

/** A company icon fetched from the web (stored in the data volume). Only for signed-in users. */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) error(401, 'Bitte anmelden.');
	const icon = await readIcon(params.id);
	if (!icon) error(404, 'Logo nicht gefunden.');
	return new Response(new Uint8Array(icon.bytes), {
		headers: {
			'content-type': icon.contentType,
			'cache-control': 'private, max-age=604800',
			'x-content-type-options': 'nosniff',
			// Foreign images (also SVG) may never run anything.
			'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox"
		}
	});
};
