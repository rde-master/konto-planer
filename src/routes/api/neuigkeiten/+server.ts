import { error, json } from '@sveltejs/kit';
import { markSeen } from '#lib/server/changelog.js';
import type { RequestHandler } from './$types';

// "Was ist neu" was read: remember the current version for this user.
export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Nicht angemeldet.');
	await markSeen(locals.user);
	return json({ ok: true });
};
