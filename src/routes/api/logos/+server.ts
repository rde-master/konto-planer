import { error, json } from '@sveltejs/kit';
import { searchLogos } from '#lib/server/logos.js';
import type { RequestHandler } from './$types';

/** Search for the logo picker: ?q=telekom */
export const GET: RequestHandler = ({ url, locals }) => {
	if (!locals.user) error(401, 'Bitte anmelden.');
	const q = (url.searchParams.get('q') ?? '').slice(0, 60);
	return json(searchLogos(q).map(({ slug, title, hex }) => ({ slug, title, hex })));
};
