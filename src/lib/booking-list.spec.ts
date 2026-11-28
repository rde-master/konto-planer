import { describe, expect, it } from 'vitest';
import { bookingTitle, categoryDots, recurringNote } from './booking-list';

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

describe('bookingTitle', () => {
	const b = { counterparty: 'VODAFONE GMBH 4711', purpose: 'Rechnung', altName: 'Handy Lisa' };

	it('shows the alternative name of the recurring item if wanted', () => {
		expect(bookingTitle(b, true)).toBe('Handy Lisa');
		expect(bookingTitle(b, false)).toBe('VODAFONE GMBH 4711');
	});

	it('keeps the payee without an alternative name', () => {
		expect(bookingTitle({ ...b, altName: null }, true)).toBe('VODAFONE GMBH 4711');
		expect(bookingTitle({ ...b, altName: '  ' }, true)).toBe('VODAFONE GMBH 4711');
		expect(bookingTitle({ counterparty: 'Bäcker', purpose: null }, true)).toBe('Bäcker');
	});

	it('falls back to purpose, category and a general word', () => {
		expect(bookingTitle({ counterparty: null, purpose: 'Brötchen' }, true)).toBe('Brötchen');
		expect(
			bookingTitle({ counterparty: null, purpose: null, category: { name: 'Essen' } }, false)
		).toBe('Essen');
		expect(bookingTitle({ counterparty: null, purpose: null }, true)).toBe('Buchung');
		expect(bookingTitle({ counterparty: null, purpose: null }, true, 'Ausgabe')).toBe('Ausgabe');
	});

	it('names the item in the note below when the title is the alternative name', () => {
		expect(recurringNote(bookingTitle(b, true), 'Mobilfunk')).toBe('Dauerposten Mobilfunk');
	});
});
