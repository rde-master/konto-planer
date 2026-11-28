import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { desc, eq, sql } from 'drizzle-orm';
import { DATABASE_URL } from '$app/env/private';
import { db } from './db/index.js';
import { notificationLog, pushSubscriptions } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { backupDir, dump, prune } from './backup.js';
import { backupFileName, isBackupFile } from './backup-rules.js';
import { attachmentDir } from './attachments.js';
import { notifySettings } from './notify.js';
import { pushoverToken, pushoverUsers } from './pushover.js';
import { haSensorsEnabled } from './api.js';
import { JOB_LABELS, listJobRuns } from './jobs.js';
import { compareVersions } from '../system.js';

const startedAt = new Date();

async function dirSize(dir: string): Promise<{ bytes: number; files: number }> {
	let bytes = 0;
	let files = 0;
	try {
		for (const e of await readdir(dir, { withFileTypes: true })) {
			const p = path.join(dir, e.name);
			if (e.isDirectory()) {
				const sub = await dirSize(p);
				bytes += sub.bytes;
				files += sub.files;
			} else if (e.isFile()) {
				bytes += (await stat(p)).size;
				files++;
			}
		}
	} catch {
		/* missing directory = empty */
	}
	return { bytes, files };
}

export async function listBackups() {
	const dir = backupDir();
	const names = await readdir(dir)
		.then((all) => all.filter(isBackupFile))
		.catch(() => [] as string[]);
	const out = [];
	for (const name of names.sort().reverse()) {
		const s = await stat(path.join(dir, name));
		out.push({ name, size: s.size, at: s.mtime, manual: name.includes('_manuell-') });
	}
	return out;
}

/** "Jetzt sichern": pg_dump like before migrations; old backups are pruned. */
export async function createBackup(actor: NonNullable<Actor>) {
	const dir = backupDir();
	await mkdir(dir, { recursive: true });
	const name = backupFileName(__APP_VERSION__, new Date(), 'manuell');
	await dump(DATABASE_URL ?? '', path.join(dir, name));
	await prune(dir);
	await db.transaction(async (tx) => {
		await audit(tx, {
			actor,
			entityType: 'settings',
			action: 'update',
			entityLabel: 'Sicherung',
			after: { backup: name }
		});
	});
	return name;
}

/** Path of a backup for download (null for anything that is not one of ours). */
export function backupPath(name: string): string | null {
	return isBackupFile(name) ? path.join(backupDir(), name) : null;
}

let updateCache: { at: number; value: { latest: string; url: string } | null } | null = null;

/** Latest release on GitHub (cached 6 hours); sends no personal data. */
export async function latestRelease(force = false) {
	if (!force && updateCache && Date.now() - updateCache.at < 6 * 3600_000) return updateCache.value;
	let value: { latest: string; url: string } | null = null;
	try {
		const res = await fetch(
			'https://api.github.com/repos/rde-master/konto-planer/releases/latest',
			{
				headers: { accept: 'application/vnd.github+json', 'user-agent': 'konto-planer' },
				signal: AbortSignal.timeout(5000)
			}
		);
		if (res.ok) {
			const body = (await res.json()) as { tag_name?: string; html_url?: string };
			if (body.tag_name)
				value = { latest: body.tag_name.replace(/^v/, ''), url: body.html_url ?? '' };
		}
	} catch {
		value = null;
	}
	updateCache = { at: Date.now(), value };
	return value;
}

export async function systemStatus() {
	const [
		[dbInfo],
		counts,
		jobs,
		backups,
		attachments,
		settings,
		haSensors,
		lastErrors,
		devices,
		pushover,
		pushoverKeys
	] = await Promise.all([
		db.execute<{ version: string; size: string }>(
			sql`select version() as version, pg_database_size(current_database())::text as size`
		),
		db.execute<{ bookings: string; accounts: string; users: string; items: string }>(
			sql`select (select count(*) from bookings)::text as bookings, (select count(*) from accounts)::text as accounts, (select count(*) from users)::text as users, (select count(*) from recurring_items)::text as items`
		),
		listJobRuns(),
		listBackups(),
		dirSize(attachmentDir()),
		notifySettings(),
		haSensorsEnabled(),
		Promise.all(
			['email', 'ha', 'push', 'pushover'].map(async (channel) => {
				const [row] = await db
					.select({
						ok: notificationLog.ok,
						error: notificationLog.error,
						at: notificationLog.sentAt
					})
					.from(notificationLog)
					.where(eq(notificationLog.channel, channel))
					.orderBy(desc(notificationLog.sentAt))
					.limit(1);
				return [channel, row ?? null] as const;
			})
		),
		db.select({ n: sql<string>`count(*)::text` }).from(pushSubscriptions),
		pushoverToken(),
		pushoverUsers()
	]);
	const release = await latestRelease();
	const last = new Map(lastErrors);
	return {
		version: __APP_VERSION__,
		node: process.version,
		startedAt,
		update: release && compareVersions(release.latest, __APP_VERSION__) > 0 ? release : null,
		releaseChecked: release !== null,
		database: {
			version: (dbInfo?.version ?? '').split(' ').slice(0, 2).join(' '),
			size: Number(dbInfo?.size ?? 0),
			...Object.fromEntries(Object.entries(counts[0] ?? {}).map(([k, v]) => [k, Number(v)]))
		} as {
			version: string;
			size: number;
			bookings: number;
			accounts: number;
			users: number;
			items: number;
		},
		storage: {
			attachments,
			backups: { bytes: backups.reduce((s, b) => s + b.size, 0), files: backups.length }
		},
		backups,
		jobs: Object.keys(JOB_LABELS).map((job) => ({
			job,
			label: JOB_LABELS[job],
			run: jobs.find((j) => j.job === job) ?? null
		})),
		connections: [
			{ name: 'E-Mail (SMTP)', ready: !!settings.smtp, last: last.get('email') ?? null },
			{
				name: 'Home Assistant',
				ready: !!settings.ha,
				last: last.get('ha') ?? null,
				extra: haSensors ? 'Sensoren an' : null
			},
			{
				name: 'Push',
				ready: Number(devices[0]?.n ?? 0) > 0,
				last: last.get('push') ?? null,
				extra: `${devices[0]?.n ?? 0} Geräte`
			},
			{
				name: 'Pushover',
				ready: pushover !== null,
				last: last.get('pushover') ?? null,
				extra: pushover !== null ? `${pushoverKeys.size} Benutzer` : null
			}
		]
	};
}
