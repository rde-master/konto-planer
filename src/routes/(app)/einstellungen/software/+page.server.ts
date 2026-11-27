import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { libraryGroups, shortVersion } from '#lib/libraries.js';
import type { PageServerLoad } from './$types';

/** What the app is built with: runtime, frameworks, libraries and tools with their versions. */
export const load: PageServerLoad = async () => {
	const [row] = await db.execute<{ version: string }>(
		sql`select current_setting('server_version') as version`
	);
	return {
		version: __APP_VERSION__,
		runtime: [
			{
				label: 'Node.js',
				version: shortVersion(process.version),
				note: 'Führt den Server der App aus'
			},
			{
				label: 'PostgreSQL',
				version: shortVersion(String(row?.version ?? '')),
				note: 'Datenbank für alle Daten der App'
			}
		],
		groups: libraryGroups(__APP_LIBRARIES__)
	};
};
