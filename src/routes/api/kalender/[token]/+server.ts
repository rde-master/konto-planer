import { error } from '@sveltejs/kit';
import { calendarEvents, feedByToken } from '#lib/server/calendar.js';
import { buildIcs } from '#lib/ical.js';
import type { RequestHandler } from './$types';

// Calendar subscription: reachable without login, the secret token in the path is the key.
export const GET: RequestHandler = async ({ params }) => {
	const token = params.token.replace(/\.ics$/, '');
	const feed = await feedByToken(token);
	if (!feed) error(404, 'Unbekannter Kalender.');
	const events = await calendarEvents(feed.viewer, feed.include);
	return new Response(buildIcs('Konto Planer', events, new Date()), {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': 'inline; filename="konto-planer.ics"',
			'cache-control': 'private, max-age=300'
		}
	});
};
