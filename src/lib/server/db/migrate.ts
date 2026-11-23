import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { DATABASE_URL } from '$app/env/private';
import { dev } from '$app/env';
import { db } from './index.js';
import { MIGRATIONS_DIR, backupBeforeMigration } from '../backup.js';

/** Runs on server start: backup if migrations are pending, then migrate. */
export async function prepareDatabase() {
	if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
	await backupBeforeMigration({ databaseUrl: DATABASE_URL, appVersion: __APP_VERSION__, dev });
	await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}
