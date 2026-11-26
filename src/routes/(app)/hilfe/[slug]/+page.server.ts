import { error } from '@sveltejs/kit';
import { HELP } from '#lib/server/help.js';
import { renderHelp } from '#lib/help.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const i = HELP.findIndex((c) => c.slug === params.slug);
	if (i < 0) error(404, 'Kapitel nicht gefunden.');
	const c = HELP[i];
	return {
		title: c.title,
		html: renderHelp(c.markdown, '/hilfe'),
		next: HELP[i + 1] ? { slug: HELP[i + 1].slug, title: HELP[i + 1].title } : null
	};
};
