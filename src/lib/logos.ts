// Company logos for payees (Simple Icons, CC0): automatic match by name, override per payee.

export type LogoRef = { slug: string; hex: string };
export type LogoEntry = LogoRef & { title: string };

/** Words of legal forms and regions that are not part of a brand name. */
const NOISE = new Set([
	'gmbh',
	'mbh',
	'ag',
	'se',
	'kg',
	'co',
	'ohg',
	'ug',
	'ev',
	'eg',
	'sarl',
	'sa',
	'bv',
	'nv',
	'ab',
	'ltd',
	'limited',
	'inc',
	'llc',
	'plc',
	'eu',
	'europe',
	'deutschland',
	'germany',
	'de',
	'international',
	'services',
	'payments'
]);

/** Lower case words without accents and punctuation ("Café Übersee" → ["cafe", "uebersee"]). */
export function words(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/&/g, ' and ')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.split(' ')
		.filter(Boolean);
}

/** Words of a payee name without legal forms ("REWE Markt GmbH" → ["rewe", "markt"]). */
export function payeeWords(name: string): string[] {
	return words(name.replace(/[&+]\s*co\b/gi, ' co')).filter((w) => !NOISE.has(w));
}

const LEGAL = new Set(['gmbh', 'mbh', 'ag', 'se', 'kg', 'ohg', 'ug', 'ev', 'eg', 'ltd', 'inc']);

/** Whether the name carries a legal form (so it is a company, not a person). */
export function hasLegalForm(name: string): boolean {
	return words(name).some((w) => LEGAL.has(w));
}

/**
 * Brand titles that are also first names ("Max Mustermann"): matched only when the name is just
 * the brand (plus legal forms), e.g. "OTTO GmbH".
 */
const FIRST_NAMES = new Set(['max', 'otto', 'julia', 'tina']);

/** Payee names that differ from the brand's title. */
const ALIASES: Record<string, string> = {
	telekom: 'deutschetelekom',
	'db vertrieb': 'deutschebahn',
	db: 'deutschebahn',
	'1und1': '1and1',
	'1 und 1': '1and1',
	telefonica: 'o2'
};

export type LogoIndex = {
	entries: { words: string[]; entry: LogoEntry }[];
	bySlug: Map<string, LogoEntry>;
};

export function buildIndex(list: LogoEntry[]): LogoIndex {
	return {
		entries: list
			.map((entry) => ({ words: words(entry.title), entry }))
			.filter((e) => e.words.length > 0 && e.words.join('').length >= 2),
		bySlug: new Map(list.map((e) => [e.slug, e]))
	};
}

/**
 * Brand of a payee name: the longest brand title that the name starts with (whole words),
 * ignoring legal forms like "GmbH" or "S.A.R.L."; a few aliases first.
 */
export function matchLogo(index: LogoIndex, name: string | null): LogoEntry | null {
	if (!name) return null;
	// "GmbH & Co. KG", "GmbH + Co. KG": legal form, not "and".
	const all = words(name.replace(/[&+]\s*co\b/gi, ' co'));
	const payee = all.filter((w) => !NOISE.has(w));
	if (!payee.length) return null;
	for (const n of [2, 1]) {
		const alias = ALIASES[payee.slice(0, n).join(' ')];
		if (alias && index.bySlug.has(alias)) return index.bySlug.get(alias)!;
	}
	let best: { len: number; entry: LogoEntry } | null = null;
	for (const { words: title, entry } of index.entries) {
		if (title.length > payee.length) continue;
		if (!title.every((w, i) => payee[i] === w)) continue;
		if (title.length === 1 && FIRST_NAMES.has(title[0]) && payee.length > 1) continue;
		if (!best || title.length > best.len) best = { len: title.length, entry };
	}
	if (best) return best.entry;
	// "PayPal (Europe)" written together, e.g. "DEUTSCHEBAHN".
	const joined = payee.join('');
	if (index.bySlug.has(joined)) return index.bySlug.get(joined)!;
	if (FIRST_NAMES.has(payee[0]) && payee.length > 1) return null;
	return index.bySlug.get(payee[0]) ?? null;
}

/** Stored choice: a slug, NONE (initials) or nothing (automatic). */
export const NO_LOGO = '-';
/** Stored choice for an icon from the web: "web:<id>" (see web-logos.ts). */
export const WEB_PREFIX = 'web:';

/**
 * Logo of a payee: the choice made by hand, otherwise the Simple Icons match by name,
 * otherwise the web icon found by the background search (`auto`).
 */
export function resolveLogo(
	index: LogoIndex,
	name: string | null,
	override: string | undefined,
	auto?: string
): LogoRef | null {
	if (override === NO_LOGO) return null;
	if (override?.startsWith(WEB_PREFIX)) return { slug: override, hex: '' };
	const chosen = override ? index.bySlug.get(override) : matchLogo(index, name);
	if (chosen) return { slug: chosen.slug, hex: chosen.hex };
	return auto?.startsWith(WEB_PREFIX) ? { slug: auto, hex: '' } : null;
}

/** Address of a logo image. */
export function logoSrc(slug: string): string {
	return slug.startsWith(WEB_PREFIX)
		? `/api/logos/web/${slug.slice(WEB_PREFIX.length)}`
		: `/api/logos/${slug}`;
}

/** Up to two initials of a name ("Hausverwaltung Beispiel" → "HB"). */
export function initials(name: string): string {
	const w = name
		.replace(/[^\p{L}\p{N} ]/gu, ' ')
		.split(/\s+/)
		.filter((x) => x && !NOISE.has(x.toLowerCase()));
	if (!w.length) return '?';
	return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase();
}

/** Stable color for initials (one of the account colors). */
export function initialsColor(name: string, palette: string[]): string {
	let h = 0;
	for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
	return palette[h % palette.length];
}
