// Money is always an integer number of euro cents. Never use floats for amounts.

/** Highest amount accepted from input: 1 billion euro. */
export const MAX_CENTS = 100_000_000_000;

/**
 * Parses German input like "1.234,56", "-12,5", "1234", "12.50" into cents.
 * Rules: with a comma, the comma is the decimal separator and dots group thousands.
 * Without a comma, a dot followed by 1–2 digits at the end is a decimal point
 * ("12.5"), otherwise dots group thousands ("1.234"). Returns null if invalid.
 */
export function parseEuro(input: string): number | null {
	let s = input.replace(/\s|€|EUR/gi, '').replace(/^\+/, '');
	if (s === '') return null;
	const negative = s.startsWith('-') || s.startsWith('−');
	if (negative) s = s.slice(1);

	let intPart: string;
	let fracPart = '';
	if (s.includes(',')) {
		const parts = s.split(',');
		if (parts.length !== 2) return null;
		[intPart, fracPart] = parts as [string, string];
		if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(intPart)) return null;
		intPart = intPart.replaceAll('.', '');
	} else if (/^\d+\.\d{1,2}$/.test(s)) {
		[intPart, fracPart] = s.split('.') as [string, string];
	} else {
		if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(s)) return null;
		intPart = s.replaceAll('.', '');
	}
	if (!/^\d*$/.test(fracPart) || fracPart.length > 2 || intPart === '') return null;

	const cents = Number(intPart) * 100 + Number(fracPart.padEnd(2, '0') || '0');
	if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null;
	return negative && cents !== 0 ? -cents : cents;
}

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const plain = new Intl.NumberFormat('de-DE', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

/** "1.234,56 €" (uses the typographic minus for negative amounts). */
export function formatEuro(cents: number): string {
	return euro.format(cents / 100).replace('-', '−');
}

/** "1.234,56" – for prefilled input fields. */
export function formatEuroInput(cents: number): string {
	return plain.format(cents / 100);
}
