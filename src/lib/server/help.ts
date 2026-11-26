import { chapterFrom, type HelpChapter } from '../help.js';

// The help texts live in docs/hilfe (also readable on GitHub) and are embedded at build time.
const files = import.meta.glob<string>('/docs/hilfe/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

export const HELP: HelpChapter[] = Object.keys(files)
	.sort()
	.map((name) => chapterFrom(name, files[name]));
