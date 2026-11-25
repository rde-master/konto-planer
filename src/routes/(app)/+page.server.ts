import { listAccountsFor } from '#lib/server/accounts.js';
import { balancesOf } from '#lib/server/bookings.js';
import { plansFor } from '#lib/server/minimum.js';
import { listRecurringFor } from '#lib/server/recurring.js';
import { listGoalsFor } from '#lib/server/goals.js';
import { getSettings } from '#lib/server/settings.js';
import { itemLogos } from '#lib/server/logos.js';
import { metricsFor } from '#lib/server/reports.js';
import { budgetsFor } from '#lib/server/budgets.js';
import { openPayments } from '#lib/due.js';
import { cancelSoon, contractStatus } from '#lib/contracts.js';
import { addDays } from '#lib/recurring.js';
import { todayBerlin } from '#lib/dates.js';
import type { PageServerLoad } from './$types';

/** Start page: household totals, available per giro account, next payments, cancel soon. */
export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const today = todayBerlin();
	const [all, items, goals, settings] = await Promise.all([
		listAccountsFor(user),
		listRecurringFor(user),
		listGoalsFor(user),
		getSettings()
	]);
	const accounts = all.filter((a) => !a.archivedAt);
	const balances = await balancesOf(accounts);
	const plans = await plansFor(user, accounts, balances);
	const active = items.filter((i) => !i.archivedAt);
	const ids = new Set(accounts.map((a) => a.id));
	const names = new Map(accounts.map((a) => [a.id, a.name]));

	const giro = accounts
		.filter((a) => a.type === 'giro')
		.map((a) => {
			const plan = plans.get(a.id);
			return {
				id: a.id,
				name: a.name,
				color: a.color,
				balance: balances.get(a.id) ?? a.openingBalance,
				available: plan?.plan.available ?? null,
				minimum: plan?.plan.minimum ?? null,
				cutoff: plan?.cutoff.date ?? null,
				exceedsOverdraft: plan?.plan.exceedsOverdraft ?? false,
				goesNegative: plan?.plan.goesNegative ?? false
			};
		});
	const savings = accounts.filter((a) => a.type === 'sparbuch');
	const openGoals = goals.filter((g) => !g.done);

	const upcoming = openPayments(active, ids, addDays(today, 1), addDays(today, 7)).map((p) => ({
		...p,
		accountName: names.get(p.accountId) ?? ''
	}));
	const logos = await itemLogos(active.filter((i) => upcoming.some((u) => u.recurringId === i.id)));

	const soon = active
		.filter((i) => i.contract && cancelSoon(i.contract, today, settings.defaultLeadDays))
		.map((i) => {
			const status = contractStatus(i.contract!, today);
			return {
				id: i.id,
				name: i.name,
				deadline: status.state === 'fixed' ? status.deadline : null,
				end: status.end
			};
		})
		.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));

	const metrics = accounts.length ? await metricsFor(user, today) : null;
	// Budgets from 80 % on.
	const budgetAlerts = (await budgetsFor(user, today.slice(0, 7))).filter((b) => b.state !== 'ok');
	return {
		today,
		metrics: metrics ? { fixedRatio: metrics.fixedRatio, savingsRate: metrics.savingsRate } : null,
		household: {
			total: accounts.reduce((s, a) => s + (balances.get(a.id) ?? a.openingBalance), 0),
			available: giro.reduce((s, g) => s + (g.available ?? 0), 0),
			savings: savings.reduce((s, a) => s + (balances.get(a.id) ?? a.openingBalance), 0),
			goalsAllocated: openGoals.reduce((s, g) => s + g.allocated, 0),
			goalsTarget: openGoals.reduce((s, g) => s + g.targetAmount, 0),
			goalCount: openGoals.length,
			accountCount: accounts.length
		},
		giro,
		budgetAlerts,
		upcoming,
		logos,
		soon
	};
};
