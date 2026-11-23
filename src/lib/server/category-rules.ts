import { isAccountColor } from '../colors.js';
import type { FieldErrors } from './validation.js';

// Categories are global and one level deep: main categories (with colour) and subcategories.

export type CategoryInput = { name: string; parentId: string; color: string };
export type CategoryValues = { name: string; parentId: string | null; color: string | null };
export type CategoryRow = {
	id: string;
	name: string;
	parentId: string | null;
	color: string | null;
};

export type CategoryTree<T extends CategoryRow = CategoryRow> = (T & { children: T[] })[];

export const NAME_MAX = 40;

const collator = new Intl.Collator('de-DE', { sensitivity: 'base', numeric: true });

/** Main categories sorted by name, each with its sorted subcategories. */
export function buildTree<T extends CategoryRow>(rows: T[]): CategoryTree<T> {
	const byName = (a: T, b: T) => collator.compare(a.name, b.name);
	return rows
		.filter((r) => r.parentId === null)
		.sort(byName)
		.map((main) => ({
			...main,
			children: rows.filter((r) => r.parentId === main.id).sort(byName)
		}));
}

/**
 * Validates a category against the existing ones.
 * `editingId` is the category being changed (undefined when creating).
 */
export function validateCategory(
	input: CategoryInput,
	existing: CategoryRow[],
	editingId?: string
): { values: CategoryValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const name = input.name.trim().replace(/\s+/g, ' ');
	if (!name) errors.name = 'Bitte einen Namen angeben.';
	else if (name.length > NAME_MAX) errors.name = `Höchstens ${NAME_MAX} Zeichen.`;

	const parentId = input.parentId || null;
	if (parentId) {
		const parent = existing.find((c) => c.id === parentId);
		if (!parent || parent.parentId !== null || parent.id === editingId) {
			errors.parentId = 'Bitte eine Hauptkategorie wählen.';
		} else if (editingId && existing.some((c) => c.parentId === editingId)) {
			errors.parentId = 'Eine Kategorie mit Unterkategorien kann keine Unterkategorie werden.';
		}
	} else if (!isAccountColor(input.color)) {
		errors.color = 'Bitte eine Farbe wählen.';
	}

	if (
		name &&
		!errors.parentId &&
		existing.some(
			(c) => c.id !== editingId && c.parentId === parentId && collator.compare(c.name, name) === 0
		)
	) {
		errors.name = parentId
			? 'Diese Unterkategorie gibt es hier schon.'
			: 'Diese Hauptkategorie gibt es schon.';
	}

	if (Object.keys(errors).length) return { values: null, errors };
	return { values: { name, parentId, color: parentId ? null : input.color }, errors: null };
}

/** Suggested starting set, offered while there are no categories yet. */
export const DEFAULT_CATEGORIES: { name: string; color: string; children: string[] }[] = [
	{
		name: 'Wohnen',
		color: 'orange',
		children: ['Miete', 'Nebenkosten', 'Strom', 'Internet und Telefon', 'Rundfunkbeitrag']
	},
	{ name: 'Lebensmittel', color: 'green', children: ['Supermarkt', 'Bäckerei', 'Getränke'] },
	{
		name: 'Mobilität',
		color: 'blue',
		children: ['Kraftstoff', 'Nahverkehr', 'Kfz-Versicherung', 'Kfz-Steuer', 'Werkstatt']
	},
	{
		name: 'Versicherungen',
		color: 'indigo',
		children: ['Haftpflicht', 'Hausrat', 'Krankenversicherung', 'Lebensversicherung']
	},
	{
		name: 'Freizeit',
		color: 'purple',
		children: ['Abos und Streaming', 'Restaurant', 'Urlaub', 'Sport']
	},
	{ name: 'Gesundheit', color: 'red', children: ['Apotheke', 'Arzt'] },
	{ name: 'Kinder', color: 'pink', children: ['Betreuung und Schule', 'Taschengeld'] },
	{ name: 'Haushalt', color: 'brown', children: ['Einrichtung', 'Drogerie'] },
	{ name: 'Kleidung', color: 'teal', children: [] },
	{ name: 'Sparen', color: 'yellow', children: ['Sparplan', 'Rücklagen'] },
	{
		name: 'Einkommen',
		color: 'green',
		children: ['Gehalt', 'Kindergeld', 'Zinsen', 'Erstattungen']
	},
	{ name: 'Gebühren und Steuern', color: 'gray', children: ['Kontoführung', 'Steuern'] },
	{ name: 'Sonstiges', color: 'gray', children: [] }
];
