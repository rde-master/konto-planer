// Payee names as banks print them change from booking to booking: card statements add the
// day of purchase, shops a receipt or order number. The core of the name is what stays.

const DATE_PATTERNS = [
	/\b\d{4}-\d{2}-\d{2}\b/g, // 2026-11-24
	/\b\d{1,2}\.\s?\d{1,2}\.(\s?\d{4}|\s?\d{2})?(?!\d)/g, // 24.11.2026, 24.11.26, 24.11.
	/\b\d{1,2}\/\d{1,2}\/(\d{4}|\d{2})\b/g, // 24/11/2026
	/\b\d{1,2}\/(\d{4}|\d{2})\b/g, // 11/2026, 24/11
	/\b\d{1,2}:\d{2}(:\d{2})?\b/g, // 14:32
	/\b\d{1,2}\.\s?(jan|feb|mär|mar|apr|mai|may|jun|jul|aug|sep|okt|oct|nov|dez|dec)[a-zä]*\.?(\s\d{4})?/gi // 24. Nov 2026
];

/** A word that is a number or a reference code ("4711", "ab12c34", "2x4y67890"). */
function isReference(word: string): boolean {
	const digits = word.replace(/\D/g, '').length;
	// "1&1" and "o2" are names; "24", "12-34" and anything with three digits are not.
	return digits >= 3 || /^[\d.,/#-]*\d[\d.,/#-]*$/.test(word);
}

/**
 * The lasting part of a payee name as written: without dates, times, numbers and reference
 * codes ("NETFLIX.COM 24.11." → "NETFLIX.COM", "AMZN Mktp DE*2X4Y67890" → "AMZN Mktp DE",
 * "1&1 Telecom" stays). Falls back to the plain name if nothing would be left.
 */
export function payeeLabel(name: string | null | undefined): string {
	const plain = (name ?? '').replace(/\s+/g, ' ').trim();
	let s = plain;
	for (const pattern of DATE_PATTERNS) s = s.replace(pattern, ' ');
	const words = s
		.split(/[\s*]+/)
		.filter((w) => w && !isReference(w))
		// Punctuation left behind by a removed date or number ("-", "/").
		.map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
		.filter(Boolean);
	return words.join(' ') || plain;
}

/**
 * The leading words of a name up to the first date, number or reference code – unlike
 * `payeeLabel()` a text the name really contains ("REWE 4711 Markt" → "REWE"). Falls back to
 * the plain name.
 */
export function payeePrefix(name: string | null | undefined): string {
	const plain = (name ?? '').replace(/\s+/g, ' ').trim();
	const out: string[] = [];
	for (const word of plain.split(/[\s*]+/)) {
		const dated = DATE_PATTERNS.some((p) => {
			p.lastIndex = 0;
			return p.test(word);
		});
		if (dated || isReference(word)) break;
		out.push(word);
	}
	const prefix = plain.slice(0, out.join(' ').length);
	// The words are separated as in the name (a "*" would not be found otherwise).
	return (prefix === out.join(' ') ? prefix : (out[0] ?? '')) || plain;
}

/** `payeeLabel()` in lower case: the form names are compared and stored as keys in. */
export function payeeCore(name: string | null | undefined): string {
	return payeeLabel(name).toLowerCase();
}

/**
 * The same payee: one core name contains the other (ignoring case, spaces, dates and
 * numbers). Very short names only match exactly.
 */
export function samePayee(a: string | null | undefined, b: string | null | undefined): boolean {
	const x = payeeCore(a).replace(/\s+/g, '');
	const y = payeeCore(b).replace(/\s+/g, '');
	if (x === '' || y === '') return false;
	if (x === y) return true;
	const [short, long] = x.length <= y.length ? [x, y] : [y, x];
	return short.length >= 3 && long.includes(short);
}
