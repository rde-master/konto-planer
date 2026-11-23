// Prints the CHANGELOG.md section for one version (used as GitHub release notes).
// Usage: node scripts/changelog-section.mjs 0.1.0
import { readFileSync } from 'node:fs';

const version = process.argv[2];
const lines = readFileSync('CHANGELOG.md', 'utf8').split('\n');
const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
if (start === -1) {
	console.error(`No CHANGELOG section for ${version}`);
	process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && l.startsWith('## ['));
if (end === -1) end = lines.length;
console.log(
	lines
		.slice(start + 1, end)
		.join('\n')
		.trim()
);
