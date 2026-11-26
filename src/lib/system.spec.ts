import { describe, expect, it } from 'vitest';
import {
	changesSince,
	compareVersions,
	formatBytes,
	formatDuration,
	parseChangelog
} from './system';

const md = `# Changelog

Text.

## [0.3.0] – Drittes

### Neu

- Punkt \`a\`
  weiter
- Punkt b

### Hinweis

- Achtung

## [0.2.1] – Fix

- Behoben

## [0.2.0] – Zweites

### Neu

- Alt
`;

describe('parseChangelog', () => {
	it('reads versions, sections and items', () => {
		const e = parseChangelog(md);
		expect(e.map((x) => x.version)).toEqual(['0.3.0', '0.2.1', '0.2.0']);
		expect(e[0].title).toBe('Drittes');
		expect(e[0].sections).toEqual([
			{ heading: 'Neu', items: ['Punkt a weiter', 'Punkt b'] },
			{ heading: 'Hinweis', items: ['Achtung'] }
		]);
		expect(e[1].sections).toEqual([{ heading: '', items: ['Behoben'] }]);
	});
	it('picks what is new since the last seen version', () => {
		const e = parseChangelog(md);
		expect(changesSince(e, '0.2.0', '0.3.0').map((x) => x.version)).toEqual(['0.3.0', '0.2.1']);
		expect(changesSince(e, '0.3.0', '0.3.0')).toEqual([]);
	});
});

describe('helpers', () => {
	it('compares versions numerically', () => {
		expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
		expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
	});
	it('formats sizes and durations', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1536)).toBe('1,5 KB');
		expect(formatBytes(250 * 1024 * 1024)).toBe('250 MB');
		expect(formatDuration(850)).toBe('850 ms');
		expect(formatDuration(2500)).toBe('2,5 s');
	});
});
