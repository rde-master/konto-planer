// Search and filter of the booking list; the filter lives in the URL (German parameter names).
import { parseEuro, formatEuro, formatEuroInput } from './money.js';
import { formatDay } from './dates.js';

export const DIRECTIONS = ['all', 'out', 'in'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export type BookingFilter = {
	/** Text in payee, purpose, IBAN or bank booking text. */
	text: string;
	accountId: string | null;
	from: string | null;
	to: string | null;
	/** Absolute amounts in cents (sign ignored). */
	min: number | null;
	max: number | null;
	direction: Direction;
	categoryId: string | null;
	tagId: string | null;
};

export const EMPTY_FILTER: BookingFilter = {
	text: '',
	accountId: null,
	from: null,
	to: null,
	min: null,
	max: null,
	direction: 'all',
	categoryId: null,
	tagId: null
};

const PARAMS = {
	text: 'q',
	accountId: 'konto',
	from: 'von',
	to: 'bis',
	min: 'min',
	max: 'max',
	direction: 'richtung',
	categoryId: 'kategorie',
	tagId: 'tag'
} as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string | null): string | null {
	if (!value || !DATE.test(value)) return null;
	const d = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value) ? value : null;
}

function amount(value: string | null): number | null {
	if (!value) return null;
	const cents = parseEuro(value);
	return cents === null ? null : Math.abs(cents);
}

/** Reads the filter from the URL; unknown ids are dropped, swapped ranges are put in order. */
export function parseFilter(
	params: URLSearchParams,
	known: { accountIds: Set<string>; categoryIds: Set<string>; tagIds: Set<string> }
): BookingFilter {
	const get = (k: keyof typeof PARAMS) => params.get(PARAMS[k]);
	let from = validDate(get('from'));
	let to = validDate(get('to'));
	if (from && to && from > to) [from, to] = [to, from];
	let min = amount(get('min'));
	let max = amount(get('max'));
	if (min !== null && max !== null && min > max) [min, max] = [max, min];
	const id = (value: string | null, set: Set<string>) => (value && set.has(value) ? value : null);
	return {
		text: (get('text') ?? '').trim().slice(0, 100),
		accountId: id(get('accountId'), known.accountIds),
		from,
		to,
		min,
		max,
		direction: DIRECTIONS.find((d) => d === get('direction')) ?? 'all',
		categoryId: id(get('categoryId'), known.categoryIds),
		tagId: id(get('tagId'), known.tagIds)
	};
}

/** Query string of a filter (empty values left out). */
export function filterQuery(f: BookingFilter, extra: Record<string, string> = {}): string {
	const p = new URLSearchParams();
	if (f.text) p.set(PARAMS.text, f.text);
	if (f.accountId) p.set(PARAMS.accountId, f.accountId);
	if (f.from) p.set(PARAMS.from, f.from);
	if (f.to) p.set(PARAMS.to, f.to);
	if (f.min !== null) p.set(PARAMS.min, formatEuroInput(f.min));
	if (f.max !== null) p.set(PARAMS.max, formatEuroInput(f.max));
	if (f.direction !== 'all') p.set(PARAMS.direction, f.direction);
	if (f.categoryId) p.set(PARAMS.categoryId, f.categoryId);
	if (f.tagId) p.set(PARAMS.tagId, f.tagId);
	for (const [k, v] of Object.entries(extra)) p.set(k, v);
	const s = p.toString();
	return s ? `?${s}` : '';
}

/** Whether anything besides the account narrows the list. */
export function isFiltered(f: BookingFilter): boolean {
	return (
		!!f.text ||
		!!f.from ||
		!!f.to ||
		f.min !== null ||
		f.max !== null ||
		f.direction !== 'all' ||
		!!f.categoryId ||
		!!f.tagId
	);
}

export type FilterChip = { label: string; without: BookingFilter };

/** Active filters as removable chips (each with the filter without it). */
export function filterChips(
	f: BookingFilter,
	names: { category: (id: string) => string; tag: (id: string) => string }
): FilterChip[] {
	const chips: FilterChip[] = [];
	if (f.text) chips.push({ label: `„${f.text}“`, without: { ...f, text: '' } });
	if (f.from || f.to)
		chips.push({
			label:
				f.from && f.to
					? `${formatDay(f.from)} – ${formatDay(f.to)}`
					: f.from
						? `ab ${formatDay(f.from)}`
						: `bis ${formatDay(f.to!)}`,
			without: { ...f, from: null, to: null }
		});
	if (f.min !== null || f.max !== null)
		chips.push({
			label:
				f.min !== null && f.max !== null
					? `${formatEuro(f.min)} – ${formatEuro(f.max)}`
					: f.min !== null
						? `ab ${formatEuro(f.min)}`
						: `bis ${formatEuro(f.max!)}`,
			without: { ...f, min: null, max: null }
		});
	if (f.direction !== 'all')
		chips.push({
			label: f.direction === 'out' ? 'Ausgaben' : 'Einnahmen',
			without: { ...f, direction: 'all' }
		});
	if (f.categoryId)
		chips.push({ label: names.category(f.categoryId), without: { ...f, categoryId: null } });
	if (f.tagId) chips.push({ label: `#${names.tag(f.tagId)}`, without: { ...f, tagId: null } });
	return chips;
}
