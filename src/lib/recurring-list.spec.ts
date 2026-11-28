import { describe, expect, it } from 'vitest';
import {
	EMPTY_LIST_FILTER,
	INTERVAL_COLORS,
	NO_CATEGORY,
	categoryLabel,
	compareList,
	isFiltered,
	latestCategory,
	listOptions,
	listQuery,
	mainCategory,
	matchesList,
	parseListFilter,
	type ListFilter,
	type ListItem
} from './recurring-list';
import { INTERVALS } from './recurring';

const item = (o: Partial<ListItem> & { name: string }): ListItem => ({
	kind: 'expense',
	counterparty: null,
	iban: null,
	note: null,
	interval: 'monthly',
	amount: 1000,
	nextDue: '2026-12-01',
	category: null,
	...o
});

const rent = item({
	name: 'Miete',
	altName: 'Wohnung Musterweg',
	counterparty: 'Hausverwaltung Muster',
	iban: 'DE09123456780001234567',
	amount: 115000,
	category: { name: 'Miete', parentName: 'Wohnen' }
});
const power = item({
	name: 'Strom',
	amount: 8900,
	nextDue: '2026-12-15',
	category: { name: 'Strom', parentName: 'Wohnen' }
});
const fee = item({
	name: 'Rundfunkbeitrag',
	interval: 'quarterly',
	amount: 5508,
	nextDue: '2026-12-15',
	category: { name: 'Wohnen', parentName: null }
});
const salary = item({
	name: 'Gehalt',
	kind: 'income',
	amount: 348000,
	nextDue: '2026-11-27',
	category: { name: 'Gehalt', parentName: 'Einkommen' }
});
const saving = item({ name: 'Sparplan', kind: 'transfer', amount: 30000 });
const gym = item({ name: 'Fitnessstudio', note: 'Vertrag 4711', nextDue: null, amount: 3490 });
const all = [rent, power, fee, salary, saving, gym];

const filter = (f: Partial<ListFilter>): ListFilter => ({ ...EMPTY_LIST_FILTER, ...f });
const names = (f: Partial<ListFilter>) =>
	all.filter((i) => matchesList(i, filter(f))).map((i) => i.name);

describe('parseListFilter / listQuery', () => {
	it('is empty without parameters', () => {
		expect(parseListFilter(new URLSearchParams())).toEqual(EMPTY_LIST_FILTER);
		expect(listQuery(EMPTY_LIST_FILTER)).toBe('');
	});

	it('reads and writes every part', () => {
		const f = parseListFilter(
			new URLSearchParams(
				'q=%20miete%20&art=ausgaben&kategorie=Wohnen&rhythmus=quarterly&sortierung=betrag'
			)
		);
		expect(f).toEqual({
			text: 'miete',
			kind: 'expense',
			category: 'Wohnen',
			interval: 'quarterly',
			sort: 'amount'
		});
		expect(parseListFilter(new URLSearchParams(listQuery(f)))).toEqual(f);
	});

	it('ignores values it does not know', () => {
		expect(
			parseListFilter(new URLSearchParams('art=alles&rhythmus=once&sortierung=zufall&aus=abc'))
		).toEqual(EMPTY_LIST_FILTER);
	});

	it('counts the order alone not as a filter', () => {
		expect(isFiltered(filter({ sort: 'name' }))).toBe(false);
		expect(isFiltered(filter({ text: ' ' }))).toBe(false);
		expect(isFiltered(filter({ interval: 'yearly' }))).toBe(true);
	});
});

describe('matchesList', () => {
	it('searches name, payee, category, IBAN and note – every word must occur', () => {
		expect(names({ text: 'miete' })).toEqual(['Miete']);
		expect(names({ text: 'HAUSVERWALTUNG' })).toEqual(['Miete']);
		expect(names({ text: 'musterweg' })).toEqual(['Miete']);
		expect(names({ text: 'wohnen' })).toEqual(['Miete', 'Strom', 'Rundfunkbeitrag']);
		expect(names({ text: 'wohnen strom' })).toEqual(['Strom']);
		expect(names({ text: 'DE09 1234' })).toEqual(['Miete']);
		expect(names({ text: '4711' })).toEqual(['Fitnessstudio']);
		expect(names({ text: 'gibt es nicht' })).toEqual([]);
	});

	it('filters by kind and rhythm', () => {
		expect(names({ kind: 'income' })).toEqual(['Gehalt']);
		expect(names({ kind: 'transfer' })).toEqual(['Sparplan']);
		expect(names({ interval: 'quarterly' })).toEqual(['Rundfunkbeitrag']);
	});

	it('filters by main category, subcategories included', () => {
		expect(names({ category: 'Wohnen' })).toEqual(['Miete', 'Strom', 'Rundfunkbeitrag']);
		expect(names({ category: 'wohnen' })).toEqual(['Miete', 'Strom', 'Rundfunkbeitrag']);
		expect(names({ category: 'Strom' })).toEqual([]);
		expect(names({ category: NO_CATEGORY })).toEqual(['Sparplan', 'Fitnessstudio']);
	});

	it('combines the parts', () => {
		expect(names({ category: 'Wohnen', interval: 'monthly', text: 'str' })).toEqual(['Strom']);
	});
});

describe('compareList', () => {
	const sorted = (sort: ListFilter['sort']) =>
		[...all].sort((a, b) => compareList(a, b, sort)).map((i) => i.name);

	it('orders by next due date, ended items last, names between equals', () => {
		expect(sorted('due')).toEqual([
			'Gehalt',
			'Miete',
			'Sparplan',
			'Rundfunkbeitrag',
			'Strom',
			'Fitnessstudio'
		]);
	});

	it('orders by name', () => {
		expect(sorted('name')).toEqual([
			'Fitnessstudio',
			'Gehalt',
			'Miete',
			'Rundfunkbeitrag',
			'Sparplan',
			'Strom'
		]);
	});

	it('orders by amount, largest first', () => {
		expect(sorted('amount')).toEqual([
			'Gehalt',
			'Miete',
			'Sparplan',
			'Strom',
			'Rundfunkbeitrag',
			'Fitnessstudio'
		]);
	});

	it('orders by category, items without one last', () => {
		expect(sorted('category')).toEqual([
			'Gehalt',
			'Rundfunkbeitrag',
			'Miete',
			'Strom',
			'Fitnessstudio',
			'Sparplan'
		]);
	});
});

describe('listOptions', () => {
	it('offers only what occurs', () => {
		expect(listOptions(all)).toEqual({
			kinds: ['expense', 'income', 'transfer'],
			categories: ['Einkommen', 'Wohnen'],
			uncategorized: true,
			intervals: ['monthly', 'quarterly']
		});
	});

	it('does not count transfers as items without a category', () => {
		expect(listOptions([rent, saving]).uncategorized).toBe(false);
	});
});

describe('labels and colours', () => {
	it('names the category with its main category', () => {
		expect(categoryLabel(rent)).toBe('Wohnen › Miete');
		expect(categoryLabel(fee)).toBe('Wohnen');
		expect(categoryLabel(gym)).toBeNull();
		expect(mainCategory(rent)).toBe('Wohnen');
		expect(mainCategory(gym)).toBeNull();
	});

	it('has a colour of its own for every rhythm', () => {
		const colors = INTERVALS.map((i) => INTERVAL_COLORS[i]);
		expect(new Set(colors).size).toBe(INTERVALS.length);
	});
});

describe('latestCategory', () => {
	const row = (bookingDate: string, categoryId: string | null, hour = 8) => ({
		bookingDate,
		categoryId,
		createdAt: new Date(Date.UTC(2026, 10, 1, hour))
	});

	it('takes the category of the latest booking that has one', () => {
		expect(
			latestCategory([row('2026-09-01', 'old'), row('2026-11-01', 'new'), row('2026-10-01', 'mid')])
		).toBe('new');
		expect(latestCategory([row('2026-09-01', 'old'), row('2026-11-01', null)])).toBe('old');
	});

	it('lets the booking entered last decide on the same day', () => {
		expect(latestCategory([row('2026-11-01', 'late', 12), row('2026-11-01', 'early', 8)])).toBe(
			'late'
		);
	});

	it('is null without a categorised booking', () => {
		expect(latestCategory([])).toBeNull();
		expect(latestCategory([row('2026-11-01', null)])).toBeNull();
	});
});
