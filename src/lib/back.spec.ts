import { describe, expect, it } from 'vitest';
import {
	EMPTY_TRAIL,
	TRAIL_LIMIT,
	advance,
	backTarget,
	pathOf,
	plainTitle,
	type Trail
} from './back';

const e = (path: string, title = path) => ({ path, title });
const walk = (paths: string[], from: Trail = EMPTY_TRAIL) =>
	paths.reduce((t, p) => advance(t, { type: t.index < 0 ? 'enter' : 'push' }, e(p)), from);

describe('advance', () => {
	it('records pages in the order visited', () => {
		const t = walk(['/konten', '/konten/a', '/buchungen/1']);
		expect(t.entries.map((x) => x.path)).toEqual(['/konten', '/konten/a', '/buchungen/1']);
		expect(t.index).toBe(2);
	});
	it('moves with back and forward and drops the onward pages on a new visit', () => {
		let t = walk(['/konten', '/konten/a', '/buchungen/1']);
		t = advance(t, { type: 'pop', delta: -2 }, e('/konten'));
		expect(t.index).toBe(0);
		t = advance(t, { type: 'pop', delta: 1 }, e('/konten/a'));
		expect(t.index).toBe(1);
		t = advance(t, { type: 'push' }, e('/dauerposten'));
		expect(t.entries.map((x) => x.path)).toEqual(['/konten', '/konten/a', '/dauerposten']);
	});
	it('replaces the current page', () => {
		const t = advance(walk(['/a', '/b']), { type: 'replace' }, e('/c'));
		expect(t.entries.map((x) => x.path)).toEqual(['/a', '/c']);
		expect(t.index).toBe(1);
	});
	it('keeps the trail on reload and updates the title', () => {
		const t = advance(walk(['/a', '/b']), { type: 'enter' }, e('/b', 'Neu'));
		expect(t.index).toBe(1);
		expect(t.entries[1]).toEqual(e('/b', 'Neu'));
	});
	it('follows back and forward across a full page load', () => {
		const t = walk(['/a', '/b', '/c']);
		expect(advance(t, { type: 'enter' }, e('/b')).index).toBe(1);
		expect(advance({ ...t, index: 1 }, { type: 'enter' }, e('/c')).index).toBe(2);
		expect(advance(t, { type: 'enter' }, e('/x')).entries).toHaveLength(4);
	});
	it('finds its place again when out of step', () => {
		const t = walk(['/a', '/b', '/c', '/d']);
		expect(advance(t, { type: 'pop', delta: -1 }, e('/a')).index).toBe(0);
		expect(advance(t, { type: 'pop', delta: -1 }, e('/x'))).toEqual({
			entries: [e('/x')],
			index: 0
		});
	});
	it('keeps at most the limit', () => {
		const t = walk(Array.from({ length: TRAIL_LIMIT + 5 }, (_, i) => `/p/${i}`));
		expect(t.entries).toHaveLength(TRAIL_LIMIT);
		expect(t.index).toBe(TRAIL_LIMIT - 1);
		expect(t.entries.at(-1)!.path).toBe(`/p/${TRAIL_LIMIT + 4}`);
	});
});

describe('backTarget', () => {
	it('is the page visited before', () => {
		expect(backTarget(walk(['/konten', '/konten/a', '/buchungen/1']))?.path).toBe('/konten/a');
		expect(backTarget(walk(['/buchungen?konto=a', '/buchungen/1']))?.path).toBe(
			'/buchungen?konto=a'
		);
		expect(backTarget(walk(['/', '/buchungen/1']))?.path).toBe('/');
	});
	it('is nothing without a page before', () => {
		expect(backTarget(EMPTY_TRAIL)).toBeNull();
		expect(backTarget(walk(['/buchungen/1']))).toBeNull();
	});
	it('ignores the same page with other filters', () => {
		expect(backTarget(walk(['/konten/a', '/konten/a?x=1']))).toBeNull();
	});
	it('ignores a page below the current one', () => {
		// After deleting a savings goal its page is gone; "back" must not lead there.
		expect(backTarget(walk(['/mehr', '/sparziele', '/sparziele/1', '/sparziele']))).toBeNull();
		expect(backTarget(walk(['/sparziele-x', '/sparziele']))?.path).toBe('/sparziele-x');
	});
});

describe('pathOf', () => {
	it('keeps path and query', () => {
		expect(pathOf('/buchungen?konto=a#x', 'https://x.example/konten')).toBe('/buchungen?konto=a');
		expect(pathOf('?q=1', 'https://x.example/buchungen')).toBe('/buchungen?q=1');
	});
});

describe('plainTitle', () => {
	it('drops the app name', () => {
		expect(plainTitle('Girokonto · Konto Planer')).toBe('Girokonto');
		expect(plainTitle('Konto Planer')).toBe('Konto Planer');
	});
});
