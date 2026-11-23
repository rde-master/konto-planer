import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';
import * as schema from './schema';
import { DATABASE_URL } from '$app/env/private';

// postgres() connects lazily, so importing this module during the build is safe.
const client = postgres(DATABASE_URL ?? '', { onnotice: () => {} });

export const db = drizzle(client, { schema });

/** Applies pending migrations from ./drizzle (relative to the working directory). */
export async function runMigrations() {
	if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
	await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
}
