// Data for "Finanzfluss": the planned flow from the due dates of the next twelve months and
// the real flow from the bookings of the last months, with the verdict per account.
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from './db/index.js';
import { accounts, bookings, goalTransfers, recurringItems } from './db/schema.js';
import type { Viewer } from './account-rules.js';
import { listAccountsFor, type AccountWithLevel } from './accounts.js';
import { listRecurringFor, type RecurringSummary } from './recurring.js';
import { listGoalsFor, type GoalSummary } from './goals.js';
import { balancesOf } from './bookings.js';
import { forecastFor } from './forecast.js';
import { duesBetween, openPayments } from '../due.js';
import { todayBerlin } from '../dates.js';
import { monthName } from '../monthly-report.js';
import {
	FLOW_STATUS_LABELS,
	PAST_MONTHS,
	PLAN_MONTHS,
	assess,
	buildFlow,
	everydayRate,
	flowMonths,
	lowestBalance,
	lowestWithSpending,
	pastPeriod,
	planPeriod,
	verdictText,
	type FlowAccount,
	type FlowAccountType,
	type FlowGraph,
	type FlowLink,
	type FlowMonth,
	type FlowMove,
	type FlowNode,
	type FlowStatus,
	type LowPoint,
	type PastMonths
} from '../money-flow.js';

export type FlowVerdict = {
	status: FlowStatus;
	/** "Reicht", "Reicht nicht" … (empty without a verdict). */
	label: string;
	text: string;
	/** Cents per month. */
	inflow: number;
	outflow: number;
};

export type FlowAccountRow = {
	id: string;
	name: string;
	type: FlowAccountType;
	color: string;
	main: boolean;
	balance: number;
	plan: FlowVerdict;
	/** Part of the planned outflow: everyday spending, the average of the past period. */
	everyday: number;
	past: FlowVerdict;
	/** Month by month of the past period, newest first. */
	months: FlowMonth[];
};

export type FlowView = {
	main: { id: string; name: string };
	mainOptions: { value: string; label: string }[];
	months: PastMonths;
	/** Past period: "August – Oktober 2026"; `partial` = only the running month so far. */
	period: { label: string; count: number; partial: boolean };
	plan: { nodes: FlowNode[]; links: FlowLink[] };
	past: { nodes: FlowNode[]; links: FlowLink[] };
	accounts: FlowAccountRow[];
};

type Item = RecurringSummary;

/** Planned moves on the visible accounts from the due dates in [from, to]. */
function planMoves(
	items: Item[],
	visible: AccountWithLevel[],
	goals: GoalSummary[],
	/** Everyday spending per month and account (not covered by recurring items). */
	everyday: Map<string, number>,
	from: string,
	to: string
): FlowMove[] {
	const ids = new Set(visible.map((a) => a.id));
	const byId = new Map(items.map((i) => [i.id, i]));
	const moves: FlowMove[] = openPayments(items, ids, from, to).map((p) => {
		const item = byId.get(p.recurringId)!;
		if (item.kind === 'transfer')
			return {
				accountId: p.accountId,
				date: p.bookingDate,
				amount: p.amount,
				kind: 'transfer',
				otherId: p.accountId === item.accountId ? item.targetAccountId : item.accountId
			};
		return {
			accountId: p.accountId,
			date: p.bookingDate,
			amount: p.amount,
			kind: item.kind === 'income' ? (item.isSalary ? 'salary' : 'income') : 'expense',
			otherId: null
		};
	});

	// Savings goals pay their linked expense on its due days (the plan: the goal is funded).
	for (const goal of goals) {
		const item = goal.recurringId ? byId.get(goal.recurringId) : undefined;
		if (!item || goal.done || !ids.has(goal.accountId) || goal.account.archivedAt) continue;
		const start = goal.since > from ? goal.since : from;
		for (const due of duesBetween(item, item.amounts, start, to)) {
			const amount = Math.min(due.amount, goal.targetAmount);
			if (amount <= 0) continue;
			moves.push({
				accountId: goal.accountId,
				date: due.bookingDate,
				amount: -amount,
				kind: 'transfer',
				otherId: item.accountId,
				payout: true
			});
			if (ids.has(item.accountId))
				moves.push({
					accountId: item.accountId,
					date: due.bookingDate,
					amount,
					kind: 'transfer',
					otherId: goal.accountId,
					payout: true
				});
		}
	}

	for (const [accountId, rate] of everyday)
		if (rate > 0)
			moves.push({
				accountId,
				date: to,
				amount: -rate * PLAN_MONTHS,
				kind: 'expense',
				otherId: null
			});

	// A credit card is settled from its giro account: what is spent on it flows there.
	for (const card of visible) {
		if (card.type !== 'kreditkarte' || !card.settlementAccountId) continue;
		const spent = -moves
			.filter((m) => m.accountId === card.id)
			.reduce((sum, m) => sum + m.amount, 0);
		if (spent <= 0) continue;
		moves.push({
			accountId: card.id,
			date: to,
			amount: spent,
			kind: 'transfer',
			otherId: card.settlementAccountId
		});
		if (ids.has(card.settlementAccountId))
			moves.push({
				accountId: card.settlementAccountId,
				date: to,
				amount: -spent,
				kind: 'transfer',
				otherId: card.id
			});
	}
	return moves;
}

/**
 * Bookings of the visible accounts from `from` up to today as moves. The other side of a
 * transfer: the linked counter booking, the other account of a transfer item, or the other
 * booking of a savings-goal transfer.
 */
async function pastMoves(
	visible: AccountWithLevel[],
	from: string,
	today: string
): Promise<FlowMove[]> {
	if (!visible.length) return [];
	const counter = alias(bookings, 'counter');
	const goalSide = alias(bookings, 'goal_side');
	const rows = await db
		.select({
			accountId: bookings.accountId,
			date: bookings.bookingDate,
			amount: bookings.amount,
			source: bookings.source,
			recurringId: bookings.recurringId,
			itemKind: recurringItems.kind,
			itemAccountId: recurringItems.accountId,
			itemTargetId: recurringItems.targetAccountId,
			isSalary: recurringItems.isSalary,
			counterAccountId: counter.accountId,
			goalAccountId: goalSide.accountId
		})
		.from(bookings)
		.leftJoin(recurringItems, eq(recurringItems.id, bookings.recurringId))
		.leftJoin(counter, eq(counter.id, bookings.counterBookingId))
		.leftJoin(
			goalTransfers,
			sql`${bookings.source} = 'goal' and (${goalTransfers.bookingId} = ${bookings.id} or ${goalTransfers.targetBookingId} = ${bookings.id})`
		)
		.leftJoin(
			goalSide,
			sql`${goalSide.id} = case when ${goalTransfers.bookingId} = ${bookings.id} then ${goalTransfers.targetBookingId} else ${goalTransfers.bookingId} end`
		)
		.where(
			and(
				inArray(
					bookings.accountId,
					visible.map((a) => a.id)
				),
				gte(bookings.bookingDate, from),
				lte(bookings.bookingDate, today)
			)
		);
	const opening = new Map(visible.map((a) => [a.id, a.openingDate]));
	return (
		rows
			// Bookings before the opening date do not count to the balance either.
			.filter((r) => r.date >= opening.get(r.accountId)!)
			.map((r): FlowMove => {
				const otherId =
					r.counterAccountId ??
					r.goalAccountId ??
					(r.itemKind === 'transfer'
						? r.accountId === r.itemAccountId
							? r.itemTargetId
							: r.itemAccountId
						: null);
				if (otherId && otherId !== r.accountId)
					return {
						accountId: r.accountId,
						date: r.date,
						amount: r.amount,
						kind: 'transfer',
						otherId,
						payout: r.source === 'goal'
					};
				return {
					accountId: r.accountId,
					date: r.date,
					amount: r.amount,
					kind: r.amount > 0 ? (r.isSalary ? 'salary' : 'income') : 'expense',
					otherId: null,
					recurring: r.recurringId !== null
				};
			})
	);
}

/** The giro account the salary arrives on: most planned salary, then most planned income. */
function defaultMain(giro: AccountWithLevel[], plan: FlowMove[]): AccountWithLevel {
	const sum = (id: string, kinds: FlowMove['kind'][]) =>
		plan
			.filter((m) => m.accountId === id && m.amount > 0 && kinds.includes(m.kind))
			.reduce((t, m) => t + m.amount, 0);
	return [...giro].sort(
		(a, b) =>
			sum(b.id, ['salary']) - sum(a.id, ['salary']) ||
			sum(b.id, ['salary', 'income']) - sum(a.id, ['salary', 'income']) ||
			a.name.localeCompare(b.name, 'de')
	)[0];
}

function periodLabel(months: string[]): string {
	const first = monthName(months[0]);
	const last = monthName(months.at(-1)!);
	if (months.length === 1) return last;
	// "August – Oktober 2026", or with both years across the turn of the year.
	return first.slice(-4) === last.slice(-4)
		? `${first.slice(0, -5)} – ${last}`
		: `${first} – ${last}`;
}

function verdict(
	type: FlowAccountType,
	graph: FlowGraph,
	accountId: string,
	plan: boolean,
	extra: { lowest: LowPoint | null; floor: number; required: number | null }
): FlowVerdict {
	const sums = graph.sums.get(accountId);
	const a = assess({ type, inflow: sums?.inflow ?? 0, outflow: sums?.outflow ?? 0, ...extra });
	return {
		status: a.status,
		label: FLOW_STATUS_LABELS[a.status],
		text: verdictText(a, type, plan),
		inflow: a.inflow,
		outflow: a.outflow
	};
}

/**
 * The money flow of the viewer's accounts from the main account (`mainId`, by default the giro
 * account with the salary). Null without an active giro account.
 */
export async function flowFor(
	viewer: Viewer,
	options: { mainId?: string | null; months?: number | null } = {},
	today = todayBerlin()
): Promise<FlowView | null> {
	const visible = (await listAccountsFor(viewer)).filter((a) => !a.archivedAt);
	const giro = visible.filter((a) => a.type === 'giro');
	if (!giro.length) return null;
	const months: PastMonths = PAST_MONTHS.find((m) => m === options.months) ?? 6;
	const [allItems, goals] = await Promise.all([listRecurringFor(viewer), listGoalsFor(viewer)]);
	const items = allItems.filter((i) => !i.archivedAt);
	const ahead = planPeriod(today);
	const main =
		giro.find((a) => a.id === options.mainId) ??
		defaultMain(giro, planMoves(items, visible, goals, new Map(), ahead.from, ahead.to));
	const period = pastPeriod(today, months, main.openingDate);
	const booked = await pastMoves(visible, period.from, today);
	const inPeriod = booked.filter((m) => m.date <= period.to);
	// What the recurring items do not know: everyday spending, as it was in the past period.
	const everyday = new Map(
		visible.map((a) => [
			a.id,
			everydayRate(
				inPeriod.filter((m) => m.accountId === a.id),
				a.openingDate > period.from ? a.openingDate : period.from,
				period.to
			)
		])
	);
	const planned = planMoves(items, visible, goals, everyday, ahead.from, ahead.to);

	// Accounts on the other side of a transfer the viewer cannot see: only their name.
	const visibleIds = new Set(visible.map((a) => a.id));
	const foreign = [
		...new Set(
			[...planned, ...booked]
				.map((m) => m.otherId)
				.filter((id): id is string => id !== null && !visibleIds.has(id))
		)
	];
	const foreignRows = foreign.length
		? await db
				.select({
					id: accounts.id,
					name: accounts.name,
					type: accounts.type,
					color: accounts.color
				})
				.from(accounts)
				.where(inArray(accounts.id, foreign))
		: [];
	const known: FlowAccount[] = [
		...visible.map((a) => ({
			id: a.id,
			name: a.name,
			type: a.type,
			color: a.color,
			visible: true
		})),
		...foreignRows.map((a) => ({ ...a, visible: false }))
	];

	const planGraph = buildFlow(known, planned, main.id, PLAN_MONTHS);
	const pastGraph = buildFlow(known, inPeriod, main.id, period.months.length);
	const reached = [...new Set([...planGraph.reached, ...pastGraph.reached])]
		.map((id) => visible.find((a) => a.id === id))
		.filter((a) => a !== undefined);
	const balances = await balancesOf(reached);

	const rows: FlowAccountRow[] = [];
	for (const account of reached) {
		const balance = balances.get(account.id) ?? 0;
		const own = booked.filter((m) => m.accountId === account.id);
		const floor = account.type === 'giro' ? account.buffer : 0;
		// Savings accounts: what the reserves and goals need per month.
		const required =
			account.type === 'sparbuch'
				? goals
						.filter((g) => g.accountId === account.id && !g.done)
						.reduce((sum, g) => sum + (g.reserve ?? g.rate ?? 0), 0)
				: null;
		let low: LowPoint | null = null;
		if (account.type === 'giro') {
			const forecast = await forecastFor(viewer, account, balance, today);
			// Everyday spending of the account and of the cards settled from it comes on top.
			const spending = visible
				.filter((a) => a.id === account.id || a.settlementAccountId === account.id)
				.reduce((sum, a) => sum + (everyday.get(a.id) ?? 0), 0);
			low = lowestWithSpending(forecast.series, spending, forecast.lowest);
		}
		const from = account.openingDate > period.from ? account.openingDate : period.from;
		rows.push({
			id: account.id,
			name: account.name,
			type: account.type,
			color: account.color,
			main: account.id === main.id,
			balance,
			plan: verdict(account.type, planGraph, account.id, true, { lowest: low, floor, required }),
			everyday: everyday.get(account.id) ?? 0,
			past: verdict(account.type, pastGraph, account.id, false, {
				lowest: account.type === 'giro' ? lowestBalance(balance, own, from, period.to) : null,
				floor,
				required
			}),
			months: flowMonths(
				own.filter((m) => m.date <= period.to),
				period.months
			)
		});
	}

	return {
		main: { id: main.id, name: main.name },
		mainOptions: giro.map((a) => ({ value: a.id, label: a.name })),
		months,
		period: {
			label: periodLabel(period.months),
			count: period.months.length,
			partial: period.partial
		},
		plan: { nodes: planGraph.nodes, links: planGraph.links },
		past: { nodes: pastGraph.nodes, links: pastGraph.links },
		accounts: rows
	};
}
