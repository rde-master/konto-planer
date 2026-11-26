/** Number of backups kept; older ones are removed after a successful new backup. */
export const BACKUPS_TO_KEEP = 10;

/**
 * Migrations that will run on start. Drizzle applies every journal entry whose timestamp is newer
 * than the last applied one. `lastApplied` is null when the database has never been migrated.
 */
export function pendingMigrations(journalWhens: number[], lastApplied: number | null): number {
	if (lastApplied === null) return journalWhens.length;
	return journalWhens.filter((when) => when > lastApplied).length;
}

/** A backup is only useful when there is existing data and something is about to change. */
export function needsBackup(journalWhens: number[], lastApplied: number | null): boolean {
	return lastApplied !== null && pendingMigrations(journalWhens, lastApplied) > 0;
}

const stampFormat = new Intl.DateTimeFormat('sv-SE', {
	timeZone: 'Europe/Berlin',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: 'h23'
});

/**
 * e.g. "2026-11-23_12-08-34_vor-0.4.0.dump" (before a migration) or "…_manuell-0.58.0.dump"
 * – sorts chronologically by name (Berlin time).
 */
export function backupFileName(
	appVersion: string,
	date: Date,
	kind: 'vor' | 'manuell' = 'vor'
): string {
	const stamp = stampFormat.format(date).replace(' ', '_').replaceAll(':', '-');
	const version = appVersion.replace(/[^0-9A-Za-z.-]/g, '');
	return `${stamp}_${kind}-${version}.dump`;
}

const BACKUP_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_(vor|manuell)-[0-9A-Za-z.-]+\.dump$/;

/** Whether a file name is one of our backups (also guards downloads against path tricks). */
export function isBackupFile(name: string): boolean {
	return BACKUP_RE.test(name);
}

/** Backup files to delete so that only the newest `keep` remain. Ignores unrelated files. */
export function backupsToDelete(fileNames: string[], keep = BACKUPS_TO_KEEP): string[] {
	const backups = fileNames.filter((n) => BACKUP_RE.test(n)).sort();
	return backups.slice(0, Math.max(0, backups.length - keep));
}
