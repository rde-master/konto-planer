import { listAccountsFor } from '#lib/server/accounts.js';
import { balancesOf } from '#lib/server/bookings.js';
import { plansFor } from '#lib/server/minimum.js';
import { listRecurringFor } from '#lib/server/recurring.js';
import { listGoalsFor } from '#lib/server/goals.js';
import { getSettings } from '#lib/server/settings.js';
import { itemLogos } from '#lib/server/logos.js';
import { metricsFor } from '#lib/server/reports.js';
import { budgetsFor } from '#lib/server/budgets.js';
import { listRules, missingPayments } from '#lib/server/notify.js';
import { openPayments } from '#lib/due.js';
import { cancelSoon, contractStatus } from '#lib/contracts.js';
import { addDays } from '#lib/recurring.js';
import { todayBerlin } from '#lib/dates.js';
import { formatIban } from '#lib/iban.js';
import { balanceDates } from '#lib/server/import-reminder.js';
import { dashboardCharts } from '#lib/server/dashboard.js';
import { openDrafts } from '#lib/server/imports.js';
import { fail, redirect } from '@sveltejs/kit';
import {
	ManualTransferError,
	markTransferred,
	remindersFor
} from '#lib/server/manual-transfers.js';
import { formString } from '#lib/server/validation.js';
import {
	SuggestionError,
	dismissSaving,
	savingsTargets,
	suggestionsFor,
	transferSaving
} from '#lib/server/savings-suggestion.js';
import { parseEuro, formatEuro } from '#lib/money.js';
import {
	WatchError,
	createFromHint,
	dismissHint,
	hintsFor,
	increasesOn
} from '#lib/server/watch.js';
import type { Actions, PageServerLoad } from './$types';

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
	const [balances, asOf] = await Promise.all([balancesOf(accounts), balanceDates(accounts, today)]);
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
				asOf: asOf.get(a.id) ?? null,
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
	// All budgets of the month (rings); those from 80 % on are marked.
	const budgets = await budgetsFor(user, today.slice(0, 7));
	const charts = await dashboardCharts(accounts, balances, plans, active, today);
	// Expected payments not confirmed by an import (tolerance from the notification rule).
	const rules = await listRules();
	const tolerance = rules.find((r) => r.type === 'payment_missing')?.toleranceDays ?? 3;
	const lead = rules.find((r) => r.type === 'manual_transfer')?.leadDays ?? 1;
	const transfers = (await remindersFor(user, today, lead)).filter((t) => ids.has(t.accountId));
	const missing = accounts.length
		? await missingPayments(
				today,
				tolerance,
				accounts.map((a) => a.id)
			)
		: [];
	const suggestions = await suggestionsFor(user, today);
	const [hints, increases, drafts] = await Promise.all([
		hintsFor(user),
		increasesOn([...ids], today),
		openDrafts(user)
	]);
	const targets = suggestions.length ? await savingsTargets(user) : [];
	return {
		today,
		/** Uploaded bank exports (from the app or a shortcut) that still wait for the preview. */
		drafts,
		suggestions,
		targets,
		hints: hints.map((h) => ({
			id: h.id,
			name: h.name,
			amount: h.amount,
			interval: h.interval,
			lastDate: h.lastDate,
			count: h.count,
			accountName: h.accountName,
			canEdit: h.canEdit
		})),
		increases: increases.slice(0, 5),
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
		charts,
		budgets: budgets.map((b) => ({
			id: b.id,
			categoryName: b.categoryName,
			accountName: b.accountName,
			color: b.color,
			limit: b.limit,
			spent: b.spent,
			state: b.state
		})),
		goals: openGoals.map((g) => ({
			id: g.id,
			name: g.name,
			accountName: g.account.name,
			allocated: g.allocated,
			targetAmount: g.targetAmount
		})),
		missing: missing.map((m) => ({
			bookingId: m.bookingId,
			name: m.name,
			accountName: m.accountName,
			date: m.bookingDate,
			amount: m.amount
		})),
		transfers: transfers.map((t) => ({
			recurringId: t.recurringId,
			dueDate: t.dueDate,
			bookingDate: t.bookingDate,
			name: t.name,
			amount: t.amount,
			accountName: t.accountName,
			to: t.targetName ?? t.payee,
			iban: t.iban ? formatIban(t.iban) : null,
			overdue: t.overdue,
			canEdit: t.canEdit
		})),
		upcoming,
		logos,
		soon
	};
};

export const actions: Actions = {
	hintCreate: async ({ request, locals }) => {
		try {
			const { recurringId } = await createFromHint(
				locals.user!,
				formString(await request.formData(), 'id')
			);
			redirect(303, `/dauerposten/${recurringId}`);
		} catch (e) {
			if (e instanceof WatchError) return fail(400, { message: e.message });
			throw e;
		}
	},

	hintDismiss: async ({ request, locals }) => {
		try {
			const name = await dismissHint(locals.user!, formString(await request.formData(), 'id'));
			return { success: `„${name}“ wird nicht mehr vorgeschlagen.` };
		} catch (e) {
			if (e instanceof WatchError) return fail(400, { message: e.message });
			throw e;
		}
	},

	saveTransfer: async ({ request, locals }) => {
		const data = await request.formData();
		const accountId = formString(data, 'accountId');
		try {
			const result = await transferSaving(locals.user!, {
				accountId,
				salaryDueDate: formString(data, 'salaryDueDate'),
				targetId: formString(data, 'targetId'),
				amount: parseEuro(formString(data, 'amount')),
				goalId: formString(data, 'goalId')
			});
			if (result.errors)
				return fail(400, { action: 'saving' as const, accountId, errors: result.errors });
			return {
				success: `${formatEuro(result.amount)} auf ${result.target} umgebucht${result.goal ? ` und „${result.goal}“ zugeteilt` : ''}.`
			};
		} catch (e) {
			if (e instanceof SuggestionError) return fail(400, { message: e.message });
			throw e;
		}
	},

	saveDismiss: async ({ request, locals }) => {
		const data = await request.formData();
		try {
			await dismissSaving(
				locals.user!,
				formString(data, 'accountId'),
				formString(data, 'salaryDueDate')
			);
			return { success: 'Sparvorschlag ausgeblendet.' };
		} catch (e) {
			if (e instanceof SuggestionError) return fail(400, { message: e.message });
			throw e;
		}
	},

	transferred: async ({ request, locals }) => {
		const data = await request.formData();
		try {
			const name = await markTransferred(
				locals.user!,
				formString(data, 'recurringId'),
				formString(data, 'dueDate')
			);
			return { success: `${name}: als überwiesen abgehakt.` };
		} catch (e) {
			if (e instanceof ManualTransferError) return fail(400, { message: e.message });
			throw e;
		}
	}
};
