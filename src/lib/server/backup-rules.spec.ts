import { describe, expect, it } from 'vitest';
import { backupFileName, backupsToDelete, needsBackup, pendingMigrations } from './backup-rules';

const JOURNAL = [1000, 2000, 3000];

describe('pendingMigrations / needsBackup', () => {
	it('counts migrations newer than the last applied one', () => {
		expect(pendingMigrations(JOURNAL, 1000)).toBe(2);
		expect(pendingMigrations(JOURNAL, 3000)).toBe(0);
	});

	it('treats a never-migrated database as fresh install without backup', () => {
		expect(pendingMigrations(JOURNAL, null)).toBe(3);
		expect(needsBackup(JOURNAL, null)).toBe(false);
	});

	it('backs up only when existing data is about to be migrated', () => {
		expect(needsBackup(JOURNAL, 2000)).toBe(true);
		expect(needsBackup(JOURNAL, 3000)).toBe(false);
	});
});

describe('backupFileName', () => {
	it('uses Berlin time and the target version', () => {
		expect(backupFileName('0.4.0', new Date(Date.UTC(2026, 10, 23, 11, 8, 34)))).toBe(
			'2026-11-23_12-08-34_vor-0.4.0.dump'
		);
	});

	it('handles summer time', () => {
		expect(backupFileName('0.9.0', new Date(Date.UTC(2026, 6, 1, 22, 0, 0)))).toBe(
			'2026-07-02_00-00-00_vor-0.9.0.dump'
		);
	});

	it('strips unsafe characters from the version', () => {
		expect(backupFileName('../1.0', new Date(Date.UTC(2026, 0, 1)))).toBe(
			'2026-01-01_01-00-00_vor-..1.0.dump'
		);
	});
});

describe('backupsToDelete', () => {
	const names = Array.from(
		{ length: 12 },
		(_, i) => `2026-01-${String(i + 1).padStart(2, '0')}_10-00-00_vor-0.${i + 1}.0.dump`
	);

	it('keeps the newest ten', () => {
		const shuffled = [...names].reverse();
		expect(backupsToDelete(shuffled)).toEqual([names[0], names[1]]);
	});

	it('never touches unrelated files or partial dumps', () => {
		const files = [...names, 'notiz.txt', '2026-01-01_10-00-00_vor-0.1.0.dump.partial'];
		expect(backupsToDelete(files)).not.toContain('notiz.txt');
		expect(backupsToDelete(files)).not.toContain('2026-01-01_10-00-00_vor-0.1.0.dump.partial');
	});

	it('deletes nothing when there are few backups', () => {
		expect(backupsToDelete(names.slice(0, 3))).toEqual([]);
	});
});
