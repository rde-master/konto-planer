/** Removes spaces and upper-cases. */
export function normalizeIban(input: string): string {
	return input.replace(/\s+/g, '').toUpperCase();
}

const LENGTHS: Record<string, number> = { DE: 22, AT: 20, CH: 21, NL: 18, FR: 27, LU: 20, BE: 16 };

/** ISO 13616 check: country code, length, mod-97 checksum. */
export function isValidIban(input: string): boolean {
	const iban = normalizeIban(input);
	if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
	const expected = LENGTHS[iban.slice(0, 2)];
	if (expected && iban.length !== expected) return false;
	const rearranged = iban.slice(4) + iban.slice(0, 4);
	let remainder = 0;
	for (const ch of rearranged) {
		const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
		for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
	}
	return remainder === 1;
}

/** "DE89 3704 0044 0532 0130 00" */
export function formatIban(input: string): string {
	return normalizeIban(input)
		.replace(/(.{4})/g, '$1 ')
		.trim();
}

/** "•• 3000" – last four digits for lists. */
export function shortIban(input: string): string {
	return `•• ${normalizeIban(input).slice(-4)}`;
}
