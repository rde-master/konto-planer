import { describe, expect, it } from 'vitest';
import { categoryDots, recurringNote } from './booking-list';

describe('recurringNote', () => {
	it('is empty for a booking without recurring item', () => {
		expect(recurringNote('Bäcker', null)).toBeNull();
	});

	it('names the item when the row shows the bank’s text', () => {
		expect(recurringNote('APPLE.COM/BILL IRL CORK', 'iCloud')).toBe('Dauerposten iCloud');
	});

	it('does not repeat a name the row shows already', () => {
		expect(recurringNote('Miete', 'Miete')).toBe('Dauerposten');
		expect(recurringNote(' miete', 'Miete ')).toBe('Dauerposten');
	});
});

describe('categoryDots', () => {
	const cat = (color: string | null) => ({ category: { color } });

	it('has no dot without a category', () => {
		expect(categoryDots({ category: null, parts: [] })).toEqual([]);
	});

	it('shows the colour of the category', () => {
		expect(categoryDots({ ...cat('green'), parts: [] })).toEqual(['green']);
		expect(categoryDots({ ...cat(null), parts: [] })).toEqual(['gray']);
	});

	it('shows each colour of a split booking once, at most three', () => {
		expect(
			categoryDots({ ...cat('green'), parts: [cat('blue'), cat('green'), { category: null }] })
		).toEqual(['green', 'blue']);
		expect(
			categoryDots({ category: null, parts: [cat('blue'), cat('red'), cat('pink'), cat('teal')] })
		).toEqual(['blue', 'red', 'pink']);
	});
});
