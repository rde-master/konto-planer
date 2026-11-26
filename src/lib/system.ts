// System status and "Was ist neu": changelog parsing, version comparison, sizes.

export type ChangelogEntry = {
	version: string;
	title: string;
	sections: { heading: string; items: string[] }[];
};

/** Reads CHANGELOG.md ("## [x.y.z] – Titel", "### Neu", "- Punkt"). */
export function parseChangelog(md: string): ChangelogEntry[] {
	const out: ChangelogEntry[] = [];
	let entry: ChangelogEntry | null = null;
	let section: ChangelogEntry['sections'][number] | null = null;
	for (const raw of md.split(/\r?\n/)) {
		const line = raw.trimEnd();
		const head = /^## \[(\d+\.\d+\.\d+)\]\s*[–-]?\s*(.*)$/.exec(line);
		if (head) {
			entry = { version: head[1], title: head[2].trim(), sections: [] };
			section = null;
			out.push(entry);
			continue;
		}
		if (!entry) continue;
		const sub = /^### (.+)$/.exec(line);
		if (sub) {
			section = { heading: sub[1].trim(), items: [] };
			entry.sections.push(section);
			continue;
		}
		const item = /^- (.+)$/.exec(line);
		if (item) {
			if (!section) {
				section = { heading: '', items: [] };
				entry.sections.push(section);
			}
			section.items.push(item[1].replace(/`([^`]+)`/g, '$1'));
		} else if (/^\s{2,}\S/.test(raw) && section?.items.length) {
			section.items[section.items.length - 1] += ` ${line.trim()}`;
		}
	}
	return out;
}

export function compareVersions(a: string, b: string): number {
	const pa = a.replace(/^v/, '').split('.').map(Number);
	const pb = b.replace(/^v/, '').split('.').map(Number);
	for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
	return 0;
}

/** Entries newer than `seen` up to `current`, newest first. */
export function changesSince(entries: ChangelogEntry[], seen: string, current: string) {
	return entries
		.filter((e) => compareVersions(e.version, seen) > 0 && compareVersions(e.version, current) <= 0)
		.sort((a, b) => compareVersions(b.version, a.version));
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let v = bytes;
	let u = -1;
	do {
		v /= 1024;
		u++;
	} while (v >= 1024 && u < units.length - 1);
	return `${v.toFixed(v < 10 ? 1 : 0).replace('.', ',')} ${units[u]}`;
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms} ms`;
	const s = ms / 1000;
	return s < 60 ? `${s.toFixed(1).replace('.', ',')} s` : `${Math.round(s / 60)} min`;
}
