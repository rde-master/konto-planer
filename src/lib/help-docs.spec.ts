import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { chapterFrom, slugify } from './help';

// The help texts in docs/hilfe: every link and every HelpLink in the app must lead somewhere.
const dir = path.resolve('docs/hilfe');
const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
const chapters = files.map((f) => chapterFrom(f, readFileSync(path.join(dir, f), 'utf8')));
const anchors = new Map(
	chapters.map((c) => [
		c.slug,
		new Set([...c.markdown.matchAll(/^#{1,3} (.+)$/gm)].map((m) => slugify(m[1])))
	])
);

function exists(slug: string, anchor: string) {
	return anchors.has(slug) && (!anchor || anchors.get(slug)!.has(anchor));
}

function walk(d: string): string[] {
	return readdirSync(d, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory()
			? walk(path.join(d, e.name))
			: e.name.endsWith('.svelte')
				? [path.join(d, e.name)]
				: []
	);
}

describe('help texts', () => {
	it('have a title per chapter', () => {
		expect(chapters.length).toBeGreaterThanOrEqual(7);
		for (const c of chapters) expect(c.title).not.toBe(c.slug);
	});
	it('link only to existing chapters and sections', () => {
		for (const c of chapters)
			for (const m of c.markdown.matchAll(/\]\((?:\.\/)?\d+-([a-z0-9-]+)\.md(?:#([a-z0-9-]+))?\)/g))
				expect(exists(m[1], m[2] ?? ''), `${c.slug}: ${m[0]}`).toBe(true);
	});
	it('HelpLinks in the app point to existing sections', () => {
		for (const file of walk(path.resolve('src/routes')))
			for (const m of readFileSync(file, 'utf8').matchAll(
				/<HelpLink\s+chapter="([^"]+)"\s+anchor="([^"]*)"/g
			))
				expect(exists(m[1], m[2]), `${file}: ${m[1]}#${m[2]}`).toBe(true);
	});
});
