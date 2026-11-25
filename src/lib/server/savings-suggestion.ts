import { and, desc, eq, inArray, isNull, lte } from 'drizzle-orm';
import { db } from './db/index.js';
import {
	bookings,
	dueItems,
	recurringItems,
	savingsGoals,
	savingsSuggestions
} from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { listAccountsFor } from './accounts.js';
import { balancesOf } from './bookings.js';
import { plansFor } from './minimum.js';
import { listGoalsFor } from './goals.js';
import { goalShare, lastSalary, suggestedSaving, type SalaryDue } from '../savings-suggestion.js';
import { formatDay, todayBerlin } from '../dates.js';
import { formatEuro } from '../money.js';

export class SuggestionError extends Error {}

export type Suggestion = {
	accountId: string;
	accountName: string;
	salaryDueDate: string;
	salaryDate: string;
	cutoff: string;
	available: number;
	amount: number;
	canEdit: boolean;
};

/**
 * Open savings suggestions of the giro accounts the viewer sees: cutoff "salary", the latest
 * salary is booked, nothing decided for it yet and at least 10 € available.
 */
export async function suggestionsFor(viewer: Viewer, today = todayBerlin()): Promise<Suggestion[]> {
	const giro = (await listAccountsFor(viewer)).filter(
		(a) => a.type === 'giro' && !a.archivedAt && a.cutoffMode === 'salary'
	);
	if (!giro.length) return [];
	// Like the minimum balance: the chosen income, otherwise every income marked as salary.
	const flagged = await db
		.select({ id: recurringItems.id, accountId: recurringItems.accountId })
		.from(recurringItems)
		.where(
			and(
				inArray(
					recurringItems.accountId,
					giro.map((a) => a.id)
				),
				eq(recurringItems.kind, 'income'),
				eq(recurringItems.isSalary, true),
				isNull(recurringItems.archivedAt)
			)
		);
	const salaryOf = new Map(
		giro.map((a) => [
			a.id,
			a.cutoffRecurringId
				? [a.cutoffRecurringId]
				: flagged.filter((f) => f.accountId === a.id).map((f) => f.id)
		])
	);
	const salaryIds = [...salaryOf.values()].flat();
	if (!salaryIds.length) return [];
	const [dues, decided] = await Promise.all([
		db
			.select({
				recurringId: dueItems.recurringId,
				dueDate: dueItems.dueDate,
				bookingDate: dueItems.bookingDate,
				status: dueItems.status
			})
			.from(dueItems)
			.where(and(inArray(dueItems.recurringId, salaryIds), lte(dueItems.bookingDate, today)))
			.orderBy(desc(dueItems.bookingDate)),
		db
			.select({
				accountId: savingsSuggestions.accountId,
				salaryDueDate: savingsSuggestions.salaryDueDate
			})
			.from(savingsSuggestions)
			.where(
				inArray(
					savingsSuggestions.accountId,
					giro.map((a) => a.id)
				)
			)
	]);
	const done = new Set(decided.map((d) => `${d.accountId}:${d.salaryDueDate}`));
	const candidates = giro
		.map((a) => ({
			account: a,
			salary: lastSalary(
				dues.filter((d) => salaryOf.get(a.id)!.includes(d.recurringId)) as SalaryDue[],
				today
			)
		}))
		.filter((c) => c.salary && !done.has(`${c.account.id}:${c.salary.dueDate}`));
	if (!candidates.length) return [];
	const list = candidates.map((c) => c.account);
	const balances = await balancesOf(list);
	const plans = await plansFor(viewer, list, balances);
	const out: Suggestion[] = [];
	for (const { account, salary } of candidates) {
		const plan = plans.get(account.id);
		if (!plan || !salary) continue;
		const amount = suggestedSaving(plan.plan.available);
		if (!amount) continue;
		out.push({
			accountId: account.id,
			accountName: account.name,
			salaryDueDate: salary.dueDate,
			salaryDate: salary.bookingDate,
			cutoff: plan.cutoff.date,
			available: plan.plan.available,
			amount,
			canEdit: canEditAccount(account.level, false)
		});
	}
	return out;
}

/** Savings accounts to transfer to, with the goals that can take an allocation. */
export async function savingsTargets(viewer: Viewer) {
	const [accounts, goals] = await Promise.all([listAccountsFor(viewer), listGoalsFor(viewer)]);
	return accounts
		.filter((a) => a.type === 'sparbuch' && !a.archivedAt)
		.map((a) => ({
			id: a.id,
			name: a.name,
			goals: goals
				.filter((g) => g.accountId === a.id && g.canEdit && !g.done && g.allocated < g.targetAmount)
				.map((g) => ({ id: g.id, name: g.name }))
		}));
}

async function requireOpen(viewer: Viewer, accountId: string, salaryDueDate: string) {
	const s = (await suggestionsFor(viewer)).find(
		(x) => x.accountId === accountId && x.salaryDueDate === salaryDueDate
	);
	if (!s) throw new SuggestionError('Diesen Sparvorschlag gibt es nicht mehr.');
	if (!s.canEdit) throw new SuggestionError('Du darfst auf diesem Konto nichts ändern.');
	return s;
}

/**
 * "Umbuchen": books the amount from the giro account to the savings account today (two linked
 * bookings, internal for reports) and optionally allocates it to a goal.
 */
export async function transferSaving(
	actor: NonNullable<Actor> & Viewer,
	input: {
		accountId: string;
		salaryDueDate: string;
		targetId: string;
		amount: number | null;
		goalId: string;
	}
) {
	const s = await requireOpen(actor, input.accountId, input.salaryDueDate);
	const errors: Partial<Record<'amount' | 'target', string>> = {};
	const target = (await savingsTargets(actor)).find((t) => t.id === input.targetId);
	if (!target) errors.target = 'Bitte ein Sparbuch wählen.';
	const amount = input.amount;
	if (amount === null || amount <= 0) errors.amount = 'Bitte einen Betrag größer 0 eingeben.';
	else if (amount > s.available)
		errors.amount = `Höchstens ${formatEuro(Math.max(0, s.available))}, sonst ist der Mindestbestand nicht gedeckt.`;
	if (Object.keys(errors).length || !target || amount === null) return { errors };
	const goal = input.goalId
		? (await listGoalsFor(actor, { accountId: target.id })).find(
				(g) => g.id === input.goalId && g.canEdit && !g.done
			)
		: undefined;
	const today = todayBerlin();
	await db.transaction(async (tx) => {
		const purpose = `Sparen am Gehaltstag (${formatDay(s.salaryDate)})`;
		const [out] = await tx
			.insert(bookings)
			.values({
				accountId: s.accountId,
				bookingDate: today,
				amount: -amount,
				counterparty: target.name,
				purpose,
				source: 'manual',
				createdBy: actor.id
			})
			.returning({ id: bookings.id });
		const [into] = await tx
			.insert(bookings)
			.values({
				accountId: target.id,
				bookingDate: today,
				amount,
				counterparty: s.accountName,
				purpose,
				source: 'manual',
				counterBookingId: out.id,
				createdBy: actor.id
			})
			.returning({ id: bookings.id });
		await tx.update(bookings).set({ counterBookingId: into.id }).where(eq(bookings.id, out.id));
		await tx.insert(savingsSuggestions).values({
			accountId: s.accountId,
			salaryDueDate: s.salaryDueDate,
			status: 'transferred',
			amount,
			targetAccountId: target.id,
			doneBy: actor.id
		});
		await audit(tx, {
			actor,
			entityType: 'booking',
			action: 'create',
			entityId: out.id,
			entityLabel: purpose,
			after: { savingSuggestion: `${s.accountName} → ${target.name}`, amount: -amount }
		});
		const share = goal ? goalShare(amount, goal) : 0;
		if (goal && share > 0) {
			await tx
				.update(savingsGoals)
				.set({ allocated: goal.allocated + share, updatedAt: new Date() })
				.where(eq(savingsGoals.id, goal.id));
			await audit(tx, {
				actor,
				entityType: 'goal',
				action: 'allocate',
				entityId: goal.id,
				entityLabel: goal.name,
				before: { allocated: goal.allocated },
				after: { allocated: goal.allocated + share }
			});
		}
	});
	return { errors: null, amount, target: target.name, goal: goal?.name ?? null };
}

/** "Nicht jetzt": no suggestion for this salary any more. */
export async function dismissSaving(
	actor: NonNullable<Actor> & Viewer,
	accountId: string,
	salaryDueDate: string
) {
	const s = await requireOpen(actor, accountId, salaryDueDate);
	await db.transaction(async (tx) => {
		await tx.insert(savingsSuggestions).values({
			accountId,
			salaryDueDate,
			status: 'dismissed',
			doneBy: actor.id
		});
		await audit(tx, {
			actor,
			entityType: 'account',
			action: 'update',
			entityId: accountId,
			entityLabel: s.accountName,
			after: { savingSuggestion: `verworfen (Gehalt ${formatDay(s.salaryDate)})` }
		});
	});
}
