import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { backupFileName, backupsToDelete, needsBackup, pendingMigrations } from './backup-rules.js';

const run = promisify(execFile);

export const MIGRATIONS_DIR = path.resolve(process.cwd(), 'drizzle');

export function backupDir(): string {
	return path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'data', 'backups'));
}

async function journalWhens(): Promise<number[]> {
	const journal = JSON.parse(
		await readFile(path.join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8')
	) as { entries: { when: number }[] };
	return journal.entries.map((e) => e.when);
}

/** Timestamp of the last applied migration, or null for a database that was never migrated. */
async function lastAppliedMigration(): Promise<number | null> {
	const [exists] = await db.execute<{ table: string | null }>(
		sql`select to_regclass('drizzle.__drizzle_migrations')::text as table`
	);
	if (!exists?.table) return null;
	const [row] = await db.execute<{ last: string | null }>(
		sql`select max(created_at)::text as last from drizzle.__drizzle_migrations`
	);
	return row?.last ? Number(row.last) : null;
}

/** pg_dump in custom format; credentials go via PG* env vars, never via the command line. */
export async function dump(databaseUrl: string, file: string) {
	const url = new URL(databaseUrl);
	const partial = `${file}.partial`;
	await run('pg_dump', ['--format=custom', '--no-owner', `--file=${partial}`], {
		env: {
			...process.env,
			PGHOST: url.hostname,
			PGPORT: url.port || '5432',
			PGUSER: decodeURIComponent(url.username),
			PGPASSWORD: decodeURIComponent(url.password),
			PGDATABASE: url.pathname.slice(1)
		},
		timeout: 10 * 60 * 1000
	});
	await rename(partial, file);
}

export async function prune(dir: string) {
	for (const name of backupsToDelete(await readdir(dir))) {
		await rm(path.join(dir, name));
		console.log(`[backup] old backup removed: ${name}`);
	}
}

export type BackupOptions = { databaseUrl: string; appVersion: string; dev: boolean };

/**
 * Creates a database dump before pending migrations are applied.
 * Throws (and so stops the start) if the dump fails – no migration without a backup,
 * unless BACKUP_BEFORE_MIGRATION=false is set.
 */
export async function backupBeforeMigration({ databaseUrl, appVersion, dev }: BackupOptions) {
	const whens = await journalWhens();
	const last = await lastAppliedMigration();
	if (!needsBackup(whens, last)) return;

	const pending = pendingMigrations(whens, last);
	if (process.env.BACKUP_BEFORE_MIGRATION === 'false') {
		console.warn(
			`[backup] ${pending} migration(s) pending, backup disabled by BACKUP_BEFORE_MIGRATION=false`
		);
		return;
	}

	const dir = backupDir();
	const file = path.join(dir, backupFileName(appVersion, new Date()));
	console.log(`[backup] ${pending} migration(s) pending, writing ${file}`);
	try {
		await mkdir(dir, { recursive: true });
		await dump(databaseUrl, file);
	} catch (e) {
		const missing = (e as NodeJS.ErrnoException).code === 'ENOENT';
		if (missing && dev) {
			console.warn('[backup] pg_dump not installed – skipping backup in development');
			return;
		}
		throw new Error(
			`Backup before migration failed, database left unchanged. ` +
				`Fix the cause or set BACKUP_BEFORE_MIGRATION=false to migrate without backup. ` +
				`Cause: ${(e as Error).message}`,
			{ cause: e }
		);
	}
	const { size } = await stat(file);
	console.log(`[backup] done (${(size / 1024).toFixed(0)} KiB)`);
	await prune(dir);
}
