import { error } from '@sveltejs/kit';
import { openAttachment } from '#lib/server/attachments.js';
import type { RequestHandler } from './$types';

/** Streams a PDF attachment inline; only for users who may see the recurring item. */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user) error(401, 'Bitte anmelden.');
	const file = await openAttachment(locals.user, params.id, params.attachmentId);
	if (!file) error(404, 'Anhang nicht gefunden.');
	const disposition = url.searchParams.has('download') ? 'attachment' : 'inline';
	const ascii = file.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	return new Response(file.body, {
		headers: {
			'content-type': 'application/pdf',
			'content-length': String(file.size),
			'content-disposition': `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
			'x-content-type-options': 'nosniff',
			'cache-control': 'private, no-store',
			'content-security-policy': "sandbox; default-src 'none'"
		}
	});
};
