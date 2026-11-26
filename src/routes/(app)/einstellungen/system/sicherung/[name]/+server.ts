import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { requireAdmin } from '#lib/server/guards.js';
import { backupPath } from '#lib/server/system.js';
import type { RequestHandler } from './$types';

// Download of a backup (admin only; only file names of our backups).
export const GET: RequestHandler = async ({ locals, params }) => {
	requireAdmin(locals.user);
	const file = backupPath(params.name);
	if (!file) error(404, 'Sicherung nicht gefunden.');
	const info = await stat(file).catch(() => null);
	if (!info) error(404, 'Sicherung nicht gefunden.');
	return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
		headers: {
			'content-type': 'application/octet-stream',
			'content-length': String(info.size),
			'content-disposition': `attachment; filename="${params.name}"`
		}
	});
};
