// Checks a pull request against the release rules (see CLAUDE.md):
// - the PR title is a Conventional Commit (it becomes the squash commit on main)
// - feat:  bumps the minor version (0.x.0), fix:/perf: bumps the patch version (0.x.y)
// - all other types leave the version unchanged
// - every version bump has a matching section in CHANGELOG.md
//
// Usage: node scripts/check-pr.mjs "<pr title>" <base version | none>
import { readFileSync } from 'node:fs';

const TYPES = [
	'feat',
	'fix',
	'perf',
	'refactor',
	'docs',
	'test',
	'build',
	'ci',
	'chore',
	'style',
	'revert'
];
const TITLE_RE = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9-]+\\))?(!)?: \\S.*$`);

const [title = '', baseArg = 'none'] = process.argv.slice(2);
const errors = [];

const match = TITLE_RE.exec(title);
if (!match) {
	errors.push(`PR title "${title}" is not a Conventional Commit, e.g. "feat: account overview".`);
}
const type = match?.[1];
if (match?.[3]) errors.push('Breaking changes (!) are not allowed before 1.0.0.');

/** @param {string} v @returns {number[]} */
const parse = (v) => {
	const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
	if (!m) throw new Error(`Invalid version "${v}"`);
	return m.slice(1).map(Number);
};
const base = parse(baseArg === 'none' ? '0.0.0' : baseArg);
const head = /"version":\s*"([^"]+)"/.exec(readFileSync('package.json', 'utf8'))?.[1] ?? '';
const [maj, min, pat] = base;

let expected = `${maj}.${min}.${pat}`;
if (type === 'feat') expected = `${maj}.${min + 1}.0`;
else if (type === 'fix' || type === 'perf') expected = `${maj}.${min}.${pat + 1}`;

if (type && head !== expected) {
	errors.push(
		`package.json version is ${head}, expected ${expected} for a "${type}" PR (main is at ${base.join('.')}).`
	);
}

if (head !== base.join('.')) {
	const changelog = readFileSync('CHANGELOG.md', 'utf8');
	if (!changelog.includes(`## [${head}]`)) {
		errors.push(`CHANGELOG.md has no section "## [${head}]".`);
	}
}

if (errors.length) {
	for (const e of errors) console.error(`::error::${e}`);
	process.exit(1);
}
console.log(`OK: "${title}" -> version ${head}`);
