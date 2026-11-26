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
