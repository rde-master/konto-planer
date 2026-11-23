import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { DATABASE_URL } from '$app/env/private';

// postgres() connects lazily, so importing this module during the build is safe.
const client = postgres(DATABASE_URL ?? '', { onnotice: () => {} });

export const db = drizzle(client, { schema });
