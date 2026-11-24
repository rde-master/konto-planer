// Split bookings: parts with amount and category; the rest stays with the booking's category.
import { parseEuro } from './money.js';

export const MAX_PARTS = 10;

export type Part = { amount: number; categoryId: string | null };

/** Rest of the booking not covered by the parts (same sign as the booking). */
export function splitRest(amount: number, parts: Pick<Part, 'amount'>[]): number {
	return parts.reduce((rest, p) => rest - p.amount, amount);
}

/** Amount per category: the parts and the rest with the booking's category (rest 0 is left out). */
export function categoryShares(
	booking: { amount: number; categoryId: string | null },
	parts: Part[]
): Part[] {
	const rest = splitRest(booking.amount, parts);
	const out = parts.map((p) => ({ amount: p.amount, categoryId: p.categoryId }));
	if (rest !== 0 || !parts.length) out.push({ amount: rest, categoryId: booking.categoryId });
	return out;
}

export type PartInput = { amount: string; categoryId: string };

/**
 * Parts as typed (positive amounts; the booking's sign is applied). Empty rows are ignored.
 * The parts together may not exceed the booking amount.
 */
export function validateSplit(
	bookingAmount: number,
	inputs: PartInput[],
	categoryIds: Set<string>
): { parts: Part[]; errors: null } | { parts: null; errors: string[] } {
	const errors: string[] = [];
	const rows = inputs.filter((i) => i.amount.trim() || i.categoryId);
	if (rows.length > MAX_PARTS) errors.push(`Höchstens ${MAX_PARTS} Teile.`);
	const sign = bookingAmount < 0 ? -1 : 1;
	const parts: Part[] = [];
	rows.forEach((row, i) => {
		const cents = parseEuro(row.amount);
		if (cents === null || cents <= 0)
			errors.push(`Teil ${i + 1}: Bitte einen Betrag größer 0 eingeben.`);
		if (!categoryIds.has(row.categoryId))
			errors.push(`Teil ${i + 1}: Bitte eine Kategorie wählen.`);
		if (cents !== null && cents > 0)
			parts.push({ amount: sign * cents, categoryId: row.categoryId });
	});
	const covered = parts.reduce((s, p) => s + Math.abs(p.amount), 0);
	if (covered > Math.abs(bookingAmount))
		errors.push('Die Teile sind zusammen größer als der Betrag der Buchung.');
	if (errors.length) return { parts: null, errors };
	return { parts, errors: null };
}
