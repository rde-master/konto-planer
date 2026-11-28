// The list of recurring items: search, filter, order, and the marks of a row.
import type { AccountColor } from './colors.js';
import { INTERVAL_LABELS, type Interval } from './recurring.js';

export const LIST_KINDS = ['expense', 'income', 'transfer'] as const;
export type ListKind = (typeof LIST_KINDS)[number];
export const LIST_KIND_LABELS: Record<ListKind, string> = {
	expense: 'Ausgaben',
	income: 'Einnahmen',
	transfer: 'Umbuchungen'
};

export const LIST_SORTS = ['due', 'name', 'amount', 'category'] as const;
export type ListSort = (typeof LIST_SORTS)[number];
export const LIST_SORT_LABELS: Record<ListSort, string> = {
	due: 'Nächste Fälligkeit',
	name: 'Name',
	amount: 'Betrag',
	category: 'Kategorie'
};

/** Value of the category filter for items without a category. */
export const NO_CATEGORY = 'ohne';

export type ListFilter = {
	text: string;
	kind: ListKind | null;
	/** Name of a main category (its subcategories count), or `NO_CATEGORY`. */
	category: string | null;
	interval: Interval | null;
	sort: ListSort;
};

export const EMPTY_LIST_FILTER: ListFilter = {
	text: '',
	kind: null,
	category: null,
	interval: null,
	sort: 'due'
};

const URL_KINDS: Record<string, ListKind> = {
	ausgaben: 'expense',
	einnahmen: 'income',
	umbuchungen: 'transfer'
};
const URL_SORTS: Record<string, ListSort> = {
	name: 'name',
	betrag: 'amount',
	kategorie: 'category'
};
const FILTER_INTERVALS = Object.keys(INTERVAL_LABELS).filter((i) => i !== 'once') as Interval[];

const keyOf = <T extends string>(map: Record<string, T>, value: T) =>
	Object.keys(map).find((k) => map[k] === value);

/** Filter from the page's address (`q`, `art`, `kategorie`, `rhythmus`, `sortierung`). */
export function parseListFilter(params: Pick<URLSearchParams, 'get'>): ListFilter {
	const interval = params.get('rhythmus') as Interval | null;
	return {
		text: (params.get('q') ?? '').trim().slice(0, 100),
		kind: URL_KINDS[params.get('art') ?? ''] ?? null,
		category: params.get('kategorie')?.trim().slice(0, 100) || null,
		interval: interval && FILTER_INTERVALS.includes(interval) ? interval : null,
		sort: URL_SORTS[params.get('sortierung') ?? ''] ?? 'due'
	};
}

/** Query string of a filter without "?" ('' = everything, ordered by due date). */
export function listQuery(f: ListFilter): string {
	const p = new URLSearchParams();
	if (f.text.trim()) p.set('q', f.text.trim());
	if (f.kind) p.set('art', keyOf(URL_KINDS, f.kind)!);
	if (f.category) p.set('kategorie', f.category);
	if (f.interval) p.set('rhythmus', f.interval);
	if (f.sort !== 'due') p.set('sortierung', keyOf(URL_SORTS, f.sort)!);
	return p.toString();
}

/** Whether the filter hides items (the order alone does not). */
export function isFiltered(f: ListFilter): boolean {
	return Boolean(f.text.trim() || f.kind || f.category || f.interval);
}

export type ListItem = {
	name: string;
	altName?: string | null;
	kind: string;
	counterparty: string | null;
	iban: string | null;
	note: string | null;
	interval: Interval;
	amount: number | null;
	nextDue: string | null;
	category: { name: string; parentName: string | null } | null;
};

/** Main category of an item ("Wohnen" for "Wohnen › Strom"), null without a category. */
export function mainCategory(item: Pick<ListItem, 'category'>): string | null {
	return item.category ? (item.category.parentName ?? item.category.name) : null;
}

/** "Wohnen › Strom" – as in the booking list. */
export function categoryLabel(item: Pick<ListItem, 'category'>): string | null {
	const c = item.category;
	return c ? (c.parentName ? `${c.parentName} › ${c.name}` : c.name) : null;
}

const lower = (s: string) => s.toLocaleLowerCase('de');

/** Every word of the search occurs in name, alternative name, payee, category, IBAN or note. */
export function matchesList(item: ListItem, f: ListFilter): boolean {
	if (f.kind && item.kind !== f.kind) return false;
	if (f.interval && item.interval !== f.interval) return false;
	if (f.category) {
		const main = mainCategory(item);
		if (
			f.category === NO_CATEGORY
				? main !== null
				: main === null || lower(main) !== lower(f.category)
		)
			return false;
	}
	const words = lower(f.text).split(/\s+/).filter(Boolean);
	if (!words.length) return true;
	const hay = lower(
		[item.name, item.altName, item.counterparty, categoryLabel(item), item.iban, item.note]
			.filter(Boolean)
			.join(' ')
	);
	const compact = hay.replace(/\s+/g, '');
	return words.every((w) => hay.includes(w) || compact.includes(w));
}

/** Order of the rows inside an account; the name decides between equals. */
export function compareList(a: ListItem, b: ListItem, sort: ListSort): number {
	const byName = a.name.localeCompare(b.name, 'de');
	if (sort === 'name') return byName;
	if (sort === 'amount') return Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0) || byName;
	if (sort === 'category') {
		const [ca, cb] = [categoryLabel(a), categoryLabel(b)];
		// Without a category last.
		if (ca === null || cb === null) return (ca === null ? 1 : 0) - (cb === null ? 1 : 0) || byName;
		return ca.localeCompare(cb, 'de') || byName;
	}
	// Running items by next due date, ended ones last.
	return (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999') || byName;
}

/** Choices of the filters: only what occurs in the list. */
export function listOptions(items: ListItem[]): {
	kinds: ListKind[];
	categories: string[];
	uncategorized: boolean;
	intervals: Interval[];
} {
	const mains = new Set<string>();
	for (const i of items) {
		const main = mainCategory(i);
		if (main) mains.add(main);
	}
	return {
		kinds: LIST_KINDS.filter((k) => items.some((i) => i.kind === k)),
		categories: [...mains].sort((a, b) => a.localeCompare(b, 'de')),
		// Transfers never have a category: they do not count as "without".
		uncategorized: items.some((i) => i.kind !== 'transfer' && !i.category),
		intervals: FILTER_INTERVALS.filter((v) => items.some((i) => i.interval === v))
	};
}

/** Colour of the rhythm mark: the same rhythm always looks the same. */
export const INTERVAL_COLORS: Record<Interval, AccountColor> = {
	weekly: 'green',
	monthly: 'blue',
	quarterly: 'orange',
	semiannual: 'purple',
	yearly: 'red',
	custom: 'teal',
	once: 'gray'
};

/**
 * Category a recurring item without one takes over: that of its latest real booking
 * (entered by hand or imported) that has a category. Null if there is none.
 */
export function latestCategory(
	rows: { bookingDate: string; createdAt: Date; categoryId: string | null }[]
): string | null {
	let best: (typeof rows)[number] | null = null;
	for (const r of rows) {
		if (!r.categoryId) continue;
		if (
			!best ||
			r.bookingDate > best.bookingDate ||
			(r.bookingDate === best.bookingDate && r.createdAt > best.createdAt)
		)
			best = r;
	}
	return best?.categoryId ?? null;
}
