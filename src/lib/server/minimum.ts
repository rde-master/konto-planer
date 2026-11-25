import { and, eq, gt, inArray } from 'drizzle-orm';
import { db } from './db/index.js';
import { accounts, bookings } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { diff } from './audit-rules.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { getAccountFor, type AccountWithLevel } from './accounts.js';
import { listRecurringFor, type RecurringSummary } from './recurring.js';
import { goalEvents } from './goals.js';
import { isValidDate } from './recurring-rules.js';
import { duesBetween, openPayments } from '../due.js';
import {
	CUTOFF_MODES,
	minimumPlan,
	resolveCutoff,
	type Cutoff,
	type CutoffMode,
	type MinimumPlan,
	type PlanEvent
} from '../minimum.js';
import { addDays, addMonths } from '../recurring.js';
import { todayBerlin } from '../dates.js';
import type { FieldErrors } from './validation.js';

export class CutoffError extends Error {}

export type AccountPlan = {
	cutoff: Cutoff & { itemName: string | null };
	/** One-off payments in the year after the cut-off day (shown as a hint only). */
	later: { id: string; name: string; date: string; amount: number }[];
	plan: MinimumPlan;
	/** Incomes and transfers into the account that may set the cut-off day. */
	candidates: { value: string; label: string }[];
};

type Item = RecurringSummary;

/** Incomes on the account and transfers into it. */
function candidatesOf(items: Item[], accountId: string) {
	return items.filter(
		(i) =>
			(i.kind === 'income' && i.accountId === accountId) ||
			(i.kind === 'transfer' && i.targetAccountId === accountId)
	);
}

function nextBankDue(item: Item, today: string): string | null {
	return (
		duesBetween(item, item.amounts, addDays(today, 1), addMonths(today, 24))[0]?.bookingDate ?? null
	);
}

/**
 * Minimum balance and available amount of the viewer's active giro accounts up to their
 * cut-off day. `balances`: current balance per account.
 */
export async function plansFor(
	viewer: Viewer,
	list: AccountWithLevel[],
	balances: Map<string, number>,
	/** "Was wäre wenn": changes the recurring items before planning. */
	transform?: (items: RecurringSummary[]) => RecurringSummary[]
): Promise<Map<string, AccountPlan>> {
	const giro = list.filter((a) => a.type === 'giro' && !a.archivedAt);
	const result = new Map<string, AccountPlan>();
	if (!giro.length) return result;
	const today = todayBerlin();
	const loaded = (await listRecurringFor(viewer)).filter((i) => !i.archivedAt);
	const items = transform ? transform(loaded) : loaded;
	// Bookings dated after today (e.g. a provisional booking moved by hand).
	const later = await db
		.select({
			accountId: bookings.accountId,
			bookingDate: bookings.bookingDate,
			amount: bookings.amount,
			purpose: bookings.purpose,
			counterparty: bookings.counterparty
		})
		.from(bookings)
		.where(
			and(
				inArray(
					bookings.accountId,
					giro.map((a) => a.id)
				),
				gt(bookings.bookingDate, today)
			)
		);
	const goals = await goalEvents(
		giro.map((a) => a.id),
		today
	);
	for (const account of giro) {
		const candidates = candidatesOf(items, account.id);
		const chosen = candidates.find((i) => i.id === account.cutoffRecurringId);
		const salaries = chosen
			? [chosen]
			: candidates.filter((i) => i.kind === 'income' && i.isSalary);
		const next = salaries
			.map((i) => ({ item: i, date: nextBankDue(i, today) }))
			.filter((s) => s.date !== null)
			.sort((a, b) => a.date!.localeCompare(b.date!))[0];
		const cutoff = resolveCutoff(account.cutoffMode, today, {
			nextSalary: next?.date ?? null,
			date: account.cutoffDate
		});
		const events: PlanEvent[] = [
			...openPayments(items, new Set([account.id]), addDays(today, 1), cutoff.date).map((p) => ({
				date: p.bookingDate,
				amount: p.amount,
				label: p.name
			})),
			...later
				.filter((b) => b.accountId === account.id)
				.map((b) => ({
					date: b.bookingDate,
					amount: b.amount,
					label: b.purpose ?? b.counterparty ?? 'Buchung'
				})),
			...(goals.get(account.id) ?? [])
		];
		const plannedLater = openPayments(
			items.filter((i) => i.interval === 'once'),
			new Set([account.id]),
			addDays(cutoff.date, 1),
			addMonths(today, 12)
		).map((p) => ({ id: p.recurringId, name: p.name, date: p.bookingDate, amount: p.amount }));
		result.set(account.id, {
			later: plannedLater,
			cutoff: {
				...cutoff,
				itemName: cutoff.mode === 'salary' ? (next?.item.name ?? null) : null
			},
			plan: minimumPlan(
				balances.get(account.id) ?? account.openingBalance,
				account.overdraftLimit,
				events,
				cutoff.date,
				today,
				account.buffer
			),
			candidates: candidates.map((i) => ({
				value: i.id,
				label: i.isSalary ? `${i.name} (Gehalt)` : i.name
			}))
		});
	}
	return result;
}

export type CutoffInput = { mode: string; recurringId: string; date: string };
export type CutoffValues = {
	cutoffMode: CutoffMode;
	cutoffRecurringId: string | null;
	cutoffDate: string | null;
};

export function validateCutoff(
	input: CutoffInput,
	ctx: { candidateIds: Set<string>; today: string }
): { values: CutoffValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const mode = CUTOFF_MODES.find((m) => m === input.mode);
	if (!mode) errors.mode = 'Bitte einen Stichtag wählen.';
	let recurringId: string | null = null;
	let date: string | null = null;
	if (mode === 'salary' && input.recurringId) {
		if (!ctx.candidateIds.has(input.recurringId))
			errors.recurringId = 'Diesen Eingang gibt es auf dem Konto nicht.';
		else recurringId = input.recurringId;
	}
	if (mode === 'date') {
		if (!isValidDate(input.date)) errors.date = 'Bitte ein Datum wählen.';
		else if (input.date <= ctx.today) errors.date = 'Der Stichtag muss in der Zukunft liegen.';
		else date = input.date;
	}
	if (Object.keys(errors).length || !mode) return { values: null, errors };
	return {
		values: { cutoffMode: mode, cutoffRecurringId: recurringId, cutoffDate: date },
		errors: null
	};
}

/** Candidates for the cut-off income of an account (validation and select options). */
export async function cutoffCandidates(viewer: Viewer, accountId: string) {
	const items = (await listRecurringFor(viewer)).filter((i) => !i.archivedAt);
	return candidatesOf(items, accountId);
}

/** Saves the cut-off day of an account (edit right on an active giro account). */
export async function setCutoff(
	actor: NonNullable<Actor> & Viewer,
	accountId: string,
	values: CutoffValues
) {
	const account = await getAccountFor(actor, accountId);
	if (
		!account ||
		account.type !== 'giro' ||
		!canEditAccount(account.level, account.archivedAt !== null)
	)
		throw new CutoffError('Den Stichtag dieses Kontos darfst du nicht ändern.');
	const items = await cutoffCandidates(actor, accountId);
	const name = (id: string | null) => (id ? (items.find((i) => i.id === id)?.name ?? null) : null);
	await db.transaction(async (tx) => {
		await tx
			.update(accounts)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(accounts.id, accountId));
		const changes = diff(
			{
				cutoffMode: account.cutoffMode,
				cutoffItem: name(account.cutoffRecurringId),
				cutoffDate: account.cutoffDate
			},
			{
				cutoffMode: values.cutoffMode,
				cutoffItem: name(values.cutoffRecurringId),
				cutoffDate: values.cutoffDate
			}
		);
		if (changes)
			await audit(tx, {
				actor,
				entityType: 'account',
				action: 'update',
				entityId: accountId,
				entityLabel: account.name,
				...changes
			});
	});
}
