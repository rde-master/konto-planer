import { describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { LIBRARY_INFO, libraryGroups, shortVersion, type Library } from './libraries';

const lib = (name: string, dev = false, version = '1.2.3'): Library => ({
	name,
	version,
	license: 'MIT',
	dev
});

describe('libraryGroups', () => {
	it('sorts the packages into frameworks, libraries and tools', () => {
		const groups = libraryGroups([
			lib('vitest', true),
			lib('echarts'),
			lib('@sveltejs/kit', true, '3.4.0'),
			lib('svelte', true),
			lib('postgres')
		]);
		expect(groups.map((g) => [g.title, g.items.map((i) => i.label)])).toEqual([
			['Frameworks', ['Svelte', 'SvelteKit']],
			['Bibliotheken', ['Apache ECharts', 'Postgres.js']],
			['Entwicklung und Tests', ['Vitest']]
		]);
		expect(groups[0].items[1]).toMatchObject({
			name: '@sveltejs/kit',
			version: '3.4.0',
			license: 'MIT',
			url: 'https://www.npmjs.com/package/@sveltejs/kit'
		});
	});

	it('lists a package it does not know by where it is used, named ones first', () => {
		const groups = libraryGroups([lib('neu-im-betrieb'), lib('neu-im-test', true), lib('echarts')]);
		expect(groups.map((g) => [g.key, g.items.map((i) => i.label)])).toEqual([
			['library', ['Apache ECharts', 'neu-im-betrieb']],
			['tool', ['neu-im-test']]
		]);
		expect(groups[0].items[1].note).toBe('');
	});

	it('leaves out empty groups', () => {
		expect(libraryGroups([])).toEqual([]);
	});
});

describe('the build', () => {
	it('knows every direct dependency in its installed version', () => {
		const direct = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
		expect(__APP_LIBRARIES__.map((l) => l.name).sort()).toEqual(direct.sort());
		for (const l of __APP_LIBRARIES__) expect(l.version, l.name).toMatch(/^\d+\.\d+\.\d+/);
	});

	it('has a German note for every direct dependency (add new packages to LIBRARY_INFO)', () => {
		const direct = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
		expect(direct.filter((name) => !LIBRARY_INFO[name]?.note)).toEqual([]);
	});

	it('explains no package that is no longer used', () => {
		const direct = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)]);
		expect(Object.keys(LIBRARY_INFO).filter((name) => !direct.has(name))).toEqual([]);
	});
});

describe('shortVersion', () => {
	it('keeps the number only', () => {
		expect(shortVersion('v24.11.1')).toBe('24.11.1');
		expect(shortVersion('17.2 (Debian 17.2-1.pgdg120+1)')).toBe('17.2');
		expect(shortVersion('unbekannt')).toBe('unbekannt');
	});
});
