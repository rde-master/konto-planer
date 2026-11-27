// iOS shortcut ("Kurzbefehl"): the choice list, the amount and the reply text.
import { parseEuro, formatEuro } from './money.js';

export type ShortcutTemplate = {
	id: string;
	name: string;
	kind: string;
	accountId: string | null;
	categoryId: string | null;
	counterparty: string | null;
};
export type ShortcutCategory = { id: string; name: string; parentName: string | null };

export type ShortcutOption =
	| { label: string; type: 'template'; template: ShortcutTemplate }
	| { label: string; type: 'category'; categoryId: string | null };

/**
 * Templates first ("Vorlage: …"), then categories ("Haupt › Unter"), last "Ohne Kategorie";
 * labels are unique.
 */
export function shortcutOptions(
	templates: ShortcutTemplate[],
	categories: ShortcutCategory[]
): ShortcutOption[] {
	const out: ShortcutOption[] = [];
	const used = new Set<string>();
	const push = (o: ShortcutOption) => {
		if (used.has(o.label)) return;
		used.add(o.label);
		out.push(o);
	};
	for (const t of templates) push({ label: `Vorlage: ${t.name}`, type: 'template', template: t });
	for (const c of [...categories].sort((a, b) =>
		`${a.parentName ?? a.name} ${a.name}`.localeCompare(`${b.parentName ?? b.name} ${b.name}`, 'de')
	))
		push({
			label: c.parentName ? `${c.parentName} › ${c.name}` : c.name,
			type: 'category',
			categoryId: c.id
		});
	push({ label: 'Ohne Kategorie', type: 'category', categoryId: null });
	return out;
}

/**
 * The chosen entry. Without a choice – the simple shortcut asks for the amount only – it is
 * "Ohne Kategorie" (the category rules may still set one). Null for a choice that is unknown.
 */
export function chosenOption(options: ShortcutOption[], choice: unknown): ShortcutOption | null {
	const label = typeof choice === 'string' ? choice.trim() : '';
	if (!label && (choice === undefined || choice === null || typeof choice === 'string'))
		return options.find((o) => o.type === 'category' && o.categoryId === null) ?? null;
	return options.find((o) => o.label === label) ?? null;
}

/**
 * Amount from the shortcut: a number (12.8) or text ("12,80", "+1.200"). Positive = expense,
 * "+" = income; returns signed cents or null.
 */
export function shortcutAmount(value: unknown, income = false): number | null {
	let cents: number | null;
	let plus = income;
	if (typeof value === 'number') cents = Number.isFinite(value) ? Math.round(value * 100) : null;
	else if (typeof value === 'string') {
		const t = value.trim();
		plus = plus || t.startsWith('+');
		const clean = t.replace(/^[+-]/, '').replace(/\s*€$/, '');
		// "12.80" from a decimal keypad, "1.234,56" German.
		cents = /^\d+\.\d{1,2}$/.test(clean) ? Math.round(Number(clean) * 100) : parseEuro(clean);
	} else cents = null;
	if (cents === null || cents <= 0 || cents > 100_000_000) return null;
	return plus ? Math.abs(cents) : -Math.abs(cents);
}

export function shortcutReply(o: {
	amount: number;
	label: string;
	account: string;
	budget: string | null;
	available: number | null;
}): string {
	return [
		`${formatEuro(Math.abs(o.amount))} ${o.label} gebucht (${o.account})`,
		o.budget,
		o.available !== null ? `verfügbar ${formatEuro(o.available)}` : null
	]
		.filter(Boolean)
		.join(' · ');
}

/** Largest text a shortcut may send as a file (Base64 of 5 MB plus line breaks). */
export const MAX_FILE_TEXT = 7_500_000;

/**
 * The bank export a shortcut sends as text in JSON: Base64 ("Base64-codieren", with or without
 * line breaks) so the file arrives byte for byte whatever iOS calls it – or, if the text
 * already looks like the export (a semicolon never occurs in Base64), the CSV itself.
 */
export function shortcutFile(value: unknown): Uint8Array | null {
	if (typeof value !== 'string' || !value.trim() || value.length > MAX_FILE_TEXT) return null;
	if (value.includes(';')) return new TextEncoder().encode(value);
	const clean = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return null;
	let binary: string;
	try {
		binary = atob(clean);
	} catch {
		return null;
	}
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export type ImportTarget = {
	id: string;
	type: string;
	iban: string | null;
	archived: boolean;
};

/**
 * Account a file from the shortcut belongs to: the one with the file's IBAN. `certain` is
 * false when the file names no known account and the access's own account – a credit card
 * without IBAN – stands in; such a file is never booked without the preview.
 */
export function importTarget(
	ibans: string[],
	accounts: ImportTarget[],
	defaultAccountId: string | null
): { accountId: string; certain: boolean } | { error: 'several' | 'unknown' } {
	const inFile = [...new Set(ibans.filter(Boolean))];
	if (inFile.length > 1) return { error: 'several' };
	const usable = accounts.filter((a) => !a.archived && a.type !== 'sparbuch');
	const byIban = inFile.length ? usable.find((a) => a.iban === inFile[0]) : undefined;
	if (byIban) return { accountId: byIban.id, certain: true };
	const fallback = usable.find(
		(a) => a.id === defaultAccountId && a.type === 'kreditkarte' && !a.iban
	);
	return fallback ? { accountId: fallback.id, certain: false } : { error: 'unknown' };
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the shortcut shows after an import that was booked at once (the app's own words). */
export function importReply(o: {
	account: string;
	created: number;
	/** Payments of recurring items and bookings of the app the file replaced. */
	matched: number;
	duplicates: number;
	bankBalance: number | null;
	appBalance: number | null;
}): string {
	const balance =
		o.bankBalance === null || o.appBalance === null
			? null
			: o.bankBalance === o.appBalance
				? `Saldo stimmt: ${formatEuro(o.bankBalance)}`
				: `Saldo weicht ab: Bank ${formatEuro(o.bankBalance)}, App ${formatEuro(o.appBalance)} – bitte in der App prüfen`;
	return [
		`${o.account} importiert: ${o.created} neu`,
		o.matched ? `${o.matched} ersetzt` : null,
		o.duplicates ? `${o.duplicates} schon vorhanden` : null,
		balance
	]
		.filter(Boolean)
		.join(' · ');
}

/** What the shortcut shows when the file only waits for the preview in the app. */
export function previewReply(o: { account: string; fresh: number; duplicates: number }): string {
	return [
		`${o.account}: ${count(o.fresh, 'neue Buchung wartet', 'neue Buchungen warten')} auf deine Prüfung in der App`,
		o.duplicates ? `${o.duplicates} schon vorhanden` : null
	]
		.filter(Boolean)
		.join(' · ');
}

/** Nothing to take over: every row of the file is stored already. */
export function nothingNewReply(account: string, duplicates: number): string {
	return `${account}: nichts Neues – ${duplicates === 1 ? 'die Buchung ist' : `alle ${duplicates} Buchungen sind`} schon vorhanden`;
}
