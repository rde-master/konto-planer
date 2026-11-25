import {
	reportAccounts,
	reportBookings,
	reportCategories,
	reportItems
} from '#lib/server/reports.js';
import {
	compareCategories,
	comparisonPeriods,
	dayHeat,
	expensesByCategory,
	fixedCostsByMonth,
	inOutByMonth,
	monthRange,
	monthsBack,
	priceChanges,
	yearCalendar
} from '#lib/reports.js';
import { addMonths } from '#lib/recurring.js';
import { todayBerlin } from '#lib/dates.js';
import type { PageServerLoad } from './$types';

const VIEWS = ['kategorien', 'einaus', 'fixkosten', 'preise', 'kalender', 'vergleich'] as const;
type View = (typeof VIEWS)[number];

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR = /^\d{4}$/;

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const today = todayBerlin();
	const thisMonth = today.slice(0, 7);
	const view: View = VIEWS.find((v) => v === url.searchParams.get('ansicht')) ?? 'kategorien';
	const accounts = await reportAccounts(user, url.searchParams.get('konto'));
	const categories = await reportCategories();
	const base = { view, today, accounts: { value: accounts.value, options: accounts.options } };

	if (view === 'kategorien') {
		const asked = url.searchParams.get('zeitraum') ?? thisMonth;
		const period = MONTH.test(asked) || YEAR.test(asked) ? asked : thisMonth;
		const range = YEAR.test(period)
			? { from: `${period}-01-01`, to: `${period}-12-31` }
			: monthRange(period);
		const rows = await reportBookings(accounts.ids, range.from, range.to);
		return {
			...base,
			period,
			periods: [
				...monthsBack(thisMonth, 12).reverse(),
				thisMonth.slice(0, 4),
				String(Number(thisMonth.slice(0, 4)) - 1)
			],
			categories: expensesByCategory(rows, categories)
		};
	}
	if (view === 'einaus') {
		const months = monthsBack(thisMonth, 12);
		const rows = await reportBookings(accounts.ids, `${months[0]}-01`, monthRange(thisMonth).to);
		return { ...base, inOut: inOutByMonth(rows, months) };
	}
	if (view === 'fixkosten') {
		const months = [
			...monthsBack(thisMonth, 12),
			...monthsBack(addMonths(`${thisMonth}-01`, 11).slice(0, 7), 11)
		];
		const fixed = fixedCostsByMonth(await reportItems(user, accounts.ids), months);
		const now = fixed.find((m) => m.month === thisMonth)!;
		const names = new Map(categories.map((c) => [c.id, c.name]));
		return {
			...base,
			fixed: fixed.map(({ month, amount }) => ({ month, amount })),
			current: thisMonth,
			byCategory: [...now.byCategory]
				.map(([id, amount]) => ({ name: id ? (names.get(id) ?? '–') : 'Ohne Kategorie', amount }))
				.sort((a, b) => b.amount - a.amount)
		};
	}
	if (view === 'vergleich') {
		const current = Number(today.slice(0, 4));
		const asked = Number(url.searchParams.get('jahr'));
		const year = Number.isInteger(asked) && asked > 1990 && asked <= current ? asked : current;
		const periods = comparisonPeriods(year, today);
		const [now, before] = await Promise.all([
			reportBookings(accounts.ids, periods.now.from, periods.now.to),
			reportBookings(accounts.ids, periods.before.from, periods.before.to)
		]);
		const sum = (rows: typeof now) => {
			let income = 0;
			let expenses = 0;
			for (const b of rows)
				if (!b.internal) {
					if (b.amount > 0) income += b.amount;
					else expenses -= b.amount;
				}
			return { income, expenses };
		};
		return {
			...base,
			compareYear: year,
			currentYear: current,
			periods,
			totals: { now: sum(now), before: sum(before) },
			comparison: compareCategories(
				expensesByCategory(now, categories),
				expensesByCategory(before, categories)
			)
		};
	}
	if (view === 'preise') {
		const items = await reportItems(user, accounts.ids);
		return { ...base, prices: priceChanges(items, today) };
	}
	// Kalender
	const askedYear = Number(url.searchParams.get('jahr'));
	const year =
		Number.isInteger(askedYear) && askedYear > 1990 && askedYear < 2200
			? askedYear
			: Number(today.slice(0, 4));
	const items = await reportItems(user, accounts.ids);
	const askedMonth = url.searchParams.get('monat');
	const month =
		askedMonth && MONTH.test(askedMonth) && askedMonth.startsWith(String(year)) ? askedMonth : null;
	let heat = null;
	if (month) {
		const range = monthRange(month);
		heat = dayHeat(month, await reportBookings(accounts.ids, range.from, range.to), items, today);
	}
	return { ...base, year, calendar: yearCalendar(items, year), month, heat };
};
