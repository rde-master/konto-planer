import { describe, expect, it } from 'vitest';
import { EMPTY_FILTER, filterChips, filterQuery, isFiltered, parseFilter } from './search';

const known = {
	accountIds: new Set(['a1']),
	categoryIds: new Set(['c1']),
	tagIds: new Set(['t1'])
};

describe('parseFilter', () => {
	it('reads the URL and keeps only valid values', () => {
		const f = parseFilter(
			new URLSearchParams(
				'q= Netflix &konto=a1&von=2026-03-31&bis=2026-01-01&min=50&max=-10,5&richtung=out&kategorie=x&tag=t1'
			),
			known
		);
		expect(f).toEqual({
			text: 'Netflix',
			accountId: 'a1',
			from: '2026-01-01',
			to: '2026-03-31',
			min: 10_50,
			max: 50_00,
			direction: 'out',
			categoryId: null,
			tagId: 't1'
		});
		expect(parseFilter(new URLSearchParams('von=2026-02-30&richtung=x'), known)).toEqual(
			EMPTY_FILTER
		);
	});

	it('round-trips through the query string', () => {
		const f = parseFilter(new URLSearchParams('q=miete&min=10&kategorie=c1'), known);
		expect(filterQuery(f)).toBe('?q=miete&min=10%2C00&kategorie=c1');
		expect(parseFilter(new URLSearchParams(filterQuery(f).slice(1)), known)).toEqual(f);
		expect(filterQuery(EMPTY_FILTER)).toBe('');
		expect(filterQuery(EMPTY_FILTER, { anzahl: '200' })).toBe('?anzahl=200');
	});
});

describe('chips', () => {
	it('one chip per active filter; the account alone is not a filter', () => {
		expect(isFiltered({ ...EMPTY_FILTER, accountId: 'a1' })).toBe(false);
		const f = { ...EMPTY_FILTER, text: 'x', min: 1000, direction: 'in' as const, tagId: 't1' };
		const chips = filterChips(f, { category: () => 'K', tag: () => 'Urlaub' });
		expect(chips.map((c) => c.label.replace(/\s/g, ' '))).toEqual([
			'„x“',
			'ab 10,00 €',
			'Einnahmen',
			'#Urlaub'
		]);
		expect(chips[0].without.text).toBe('');
		expect(isFiltered(chips[3].without)).toBe(true);
	});
});
