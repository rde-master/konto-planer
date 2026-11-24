import { describe, expect, it } from 'vitest';
import { categoryShares, splitRest, validateSplit } from './splits';

const cats = new Set(['food', 'drug', 'home']);

describe('validateSplit', () => {
	it('applies the sign of the booking and ignores empty rows', () => {
		expect(
			validateSplit(
				-50_00,
				[
					{ amount: '12,50', categoryId: 'food' },
					{ amount: '', categoryId: '' },
					{ amount: '7', categoryId: 'drug' }
				],
				cats
			)
		).toEqual({
			parts: [
				{ amount: -12_50, categoryId: 'food' },
				{ amount: -7_00, categoryId: 'drug' }
			],
			errors: null
		});
	});

	it('needs amount and category; the parts may not exceed the booking', () => {
		expect(validateSplit(-10_00, [{ amount: '0', categoryId: 'x' }], cats).errors).toEqual([
			'Teil 1: Bitte einen Betrag größer 0 eingeben.',
			'Teil 1: Bitte eine Kategorie wählen.'
		]);
		expect(
			validateSplit(
				-10_00,
				[
					{ amount: '6', categoryId: 'food' },
					{ amount: '5', categoryId: 'drug' }
				],
				cats
			).errors
		).toEqual(['Die Teile sind zusammen größer als der Betrag der Buchung.']);
		expect(validateSplit(20_00, [{ amount: '20', categoryId: 'home' }], cats).parts).toEqual([
			{ amount: 20_00, categoryId: 'home' }
		]);
	});
});

describe('rest and shares', () => {
	it('the rest stays with the booking category', () => {
		const parts = [{ amount: -12_50, categoryId: 'food' }];
		expect(splitRest(-50_00, parts)).toBe(-37_50);
		expect(categoryShares({ amount: -50_00, categoryId: 'home' }, parts)).toEqual([
			{ amount: -12_50, categoryId: 'food' },
			{ amount: -37_50, categoryId: 'home' }
		]);
		expect(
			categoryShares({ amount: -12_50, categoryId: 'home' }, parts).map((s) => s.categoryId)
		).toEqual(['food']);
		expect(categoryShares({ amount: -5_00, categoryId: null }, [])).toEqual([
			{ amount: -5_00, categoryId: null }
		]);
	});
});
