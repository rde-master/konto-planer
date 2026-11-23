import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		await db.execute(sql`select 1`);
		return json({ status: 'ok', version: __APP_VERSION__ });
	} catch {
		return json({ status: 'error', version: __APP_VERSION__ }, { status: 503 });
	}
};
