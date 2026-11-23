import { describe, expect, it } from 'vitest';
import {
	DEFAULT_CATEGORIES,
	buildTree,
	validateCategory,
	type CategoryRow
} from './category-rules';
import { isAccountColor } from '../colors';

const rows: CategoryRow[] = [
	{ id: 'w', name: 'Wohnen', parentId: null, color: 'orange' },
	{ id: 'm', name: 'Miete', parentId: 'w', color: null },
	{ id: 's', name: 'Strom', parentId: 'w', color: null },
	{ id: 'a', name: 'Auto', parentId: null, color: 'blue' },
	{ id: 'l', name: 'Ärzte', parentId: null, color: 'red' }
];

describe('buildTree', () => {
	it('sorts main categories and subcategories by German collation', () => {
		const tree = buildTree(rows);
		expect(tree.map((c) => c.name)).toEqual(['Ärzte', 'Auto', 'Wohnen']);
		expect(tree[2].children.map((c) => c.name)).toEqual(['Miete', 'Strom']);
		expect(tree[0].children).toEqual([]);
	});
});

describe('validateCategory', () => {
	it('accepts a main category with colour', () => {
		expect(validateCategory({ name: '  Freizeit  ', parentId: '', color: 'purple' }, rows)).toEqual(
			{
				errors: null,
				values: { name: 'Freizeit', parentId: null, color: 'purple' }
			}
		);
	});

	it('drops the colour of subcategories', () => {
		expect(validateCategory({ name: 'Gas', parentId: 'w', color: 'red' }, rows).values).toEqual({
			name: 'Gas',
			parentId: 'w',
			color: null
		});
	});

	it('requires name and colour for main categories', () => {
		const { errors } = validateCategory({ name: ' ', parentId: '', color: 'nope' }, rows);
		expect(errors).toEqual({
			name: 'Bitte einen Namen angeben.',
			color: 'Bitte eine Farbe wählen.'
		});
		expect(
			validateCategory({ name: 'x'.repeat(41), parentId: '', color: 'red' }, rows).errors?.name
		).toBe('Höchstens 40 Zeichen.');
	});

	it('rejects duplicate names among siblings, ignoring case', () => {
		expect(
			validateCategory({ name: 'wohnen', parentId: '', color: 'red' }, rows).errors?.name
		).toBe('Diese Hauptkategorie gibt es schon.');
		expect(validateCategory({ name: 'MIETE', parentId: 'w', color: '' }, rows).errors?.name).toBe(
			'Diese Unterkategorie gibt es hier schon.'
		);
		// Same name under another parent is fine.
		expect(validateCategory({ name: 'Miete', parentId: 'a', color: '' }, rows).errors).toBeNull();
		// Keeping the own name while editing is fine.
		expect(
			validateCategory({ name: 'Miete', parentId: 'w', color: '' }, rows, 'm').errors
		).toBeNull();
	});

	it('allows only one level', () => {
		// Parent must be a main category.
		expect(
			validateCategory({ name: 'Kalt', parentId: 'm', color: '' }, rows).errors?.parentId
		).toBe('Bitte eine Hauptkategorie wählen.');
		expect(
			validateCategory({ name: 'X', parentId: 'unknown', color: '' }, rows).errors?.parentId
		).toBe('Bitte eine Hauptkategorie wählen.');
		// Not its own parent.
		expect(
			validateCategory({ name: 'Auto', parentId: 'a', color: '' }, rows, 'a').errors?.parentId
		).toBe('Bitte eine Hauptkategorie wählen.');
		// A main category with children cannot become a subcategory.
		expect(
			validateCategory({ name: 'Wohnen', parentId: 'a', color: '' }, rows, 'w').errors?.parentId
		).toBe('Eine Kategorie mit Unterkategorien kann keine Unterkategorie werden.');
		// Without children it can.
		expect(validateCategory({ name: 'Ärzte', parentId: 'a', color: '' }, rows, 'l').values).toEqual(
			{
				name: 'Ärzte',
				parentId: 'a',
				color: null
			}
		);
	});

	it('lets a subcategory become a main category', () => {
		expect(
			validateCategory({ name: 'Strom', parentId: '', color: 'yellow' }, rows, 's').values
		).toEqual({
			name: 'Strom',
			parentId: null,
			color: 'yellow'
		});
	});
});

describe('DEFAULT_CATEGORIES', () => {
	it('are valid and unique', () => {
		const names = DEFAULT_CATEGORIES.map((c) => c.name.toLowerCase());
		expect(new Set(names).size).toBe(names.length);
		for (const c of DEFAULT_CATEGORIES) {
			expect(isAccountColor(c.color)).toBe(true);
			expect(new Set(c.children).size).toBe(c.children.length);
			for (const name of [c.name, ...c.children]) expect(name.length).toBeLessThanOrEqual(40);
		}
	});
});
