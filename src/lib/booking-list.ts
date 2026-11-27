// Marks in the booking list: payments of recurring items and the colours of the categories.

type Categorized = { category: { color: string | null } | null };

/**
 * "Dauerposten" for a booking that belongs to a recurring item – with the item's name unless
 * the row shows it already as its title. Null for bookings without an item.
 */
export function recurringNote(title: string, name: string | null): string | null {
	if (name === null) return null;
	const same = title.trim().toLocaleLowerCase('de') === name.trim().toLocaleLowerCase('de');
	return same || !name.trim() ? 'Dauerposten' : `Dauerposten ${name.trim()}`;
}

/**
 * Colours of the dots at the top left of a row: the booking's category and those of its parts
 * (split booking), each colour once, at most `max`. Empty without a category.
 */
export function categoryDots(b: Categorized & { parts: Categorized[] }, max = 3): string[] {
	const colors: string[] = [];
	for (const c of [b.category, ...b.parts.map((p) => p.category)]) {
		if (!c) continue;
		const color = c.color ?? 'gray';
		if (!colors.includes(color)) colors.push(color);
	}
	return colors.slice(0, max);
}
