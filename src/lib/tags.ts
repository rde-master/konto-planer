// Tags: global labels in addition to the category; bookings inherit the tags of their item.
import { categoryShares, type Part } from './splits.js';

export const TAG_MAX_LENGTH = 30;

/** Trimmed tag name with single spaces and no leading "#"; error text or the name. */
export function validateTagName(
	input: string
): { name: string; error: null } | { name: null; error: string } {
	const name = input.trim().replace(/^#+/, '').replace(/\s+/g, ' ');
	if (!name) return { name: null, error: 'Bitte einen Namen eingeben.' };
	if (name.length > TAG_MAX_LENGTH)
		return { name: null, error: `Höchstens ${TAG_MAX_LENGTH} Zeichen.` };
	return { name, error: null };
}

export type YearBooking = {
	id: string;
	bookingDate: string;
	amount: number;
	categoryId: string | null;
	parts: Part[];
};

export type YearSummary = {
	income: number;
	expenses: number;
	/** Per category (split bookings counted by their parts), largest amounts first. */
	byCategory: { categoryId: string | null; amount: number }[];
	/** Months ("2026-03") with their bookings, newest first. */
	months: { month: string; total: number; bookings: YearBooking[] }[];
};

/** Totals and groups of the bookings with a tag in one year. */
export function yearSummary(bookings: YearBooking[]): YearSummary {
	let income = 0;
	let expenses = 0;
	const byCategory = new Map<string | null, number>();
	const months = new Map<string, YearBooking[]>();
	for (const b of bookings) {
		if (b.amount > 0) income += b.amount;
		else expenses += b.amount;
		for (const s of categoryShares(b, b.parts))
			byCategory.set(s.categoryId, (byCategory.get(s.categoryId) ?? 0) + s.amount);
		const month = b.bookingDate.slice(0, 7);
		months.set(month, [...(months.get(month) ?? []), b]);
	}
	return {
		income,
		expenses,
		byCategory: [...byCategory]
			.map(([categoryId, amount]) => ({ categoryId, amount }))
			.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
		months: [...months]
			.sort((a, b) => b[0].localeCompare(a[0]))
			.map(([month, list]) => ({
				month,
				total: list.reduce((s, b) => s + b.amount, 0),
				bookings: list.sort((a, b) => b.bookingDate.localeCompare(a.bookingDate))
			}))
	};
}

/** "März 2026" */
export function monthLabel(month: string): string {
	return new Date(`${month}-15T12:00:00Z`).toLocaleDateString('de-DE', {
		month: 'long',
		year: 'numeric',
		timeZone: 'Europe/Berlin'
	});
}
