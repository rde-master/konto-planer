import { error } from '@sveltejs/kit';
import { logoSvg } from '#lib/server/logos.js';
import type { RequestHandler } from './$types';

/** A logo as SVG (Simple Icons, CC0). Only for signed-in users; cached long by the browser. */
export const GET: RequestHandler = ({ params, locals }) => {
	if (!locals.user) error(401, 'Bitte anmelden.');
	const svg = logoSvg(params.slug);
	if (!svg) error(404, 'Logo nicht gefunden.');
	return new Response(svg, {
		headers: {
			'content-type': 'image/svg+xml; charset=utf-8',
			'cache-control': 'private, max-age=604800',
			'x-content-type-options': 'nosniff'
		}
	});
};
