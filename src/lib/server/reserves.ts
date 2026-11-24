import type { Viewer } from './account-rules.js';
import type { Actor } from './audit.js';
import { listRecurringFor, createRecurring, type RecurringSummary } from './recurring.js';
import { recurringFormContext } from './recurring-form.js';
import { validateAmount, validateRecurring, isValidDate } from './recurring-rules.js';
import { validateGoal, type GoalInput } from './goal-rules.js';
import { createGoal, freeOf, goalAccounts, listGoalsFor, type GoalSummary } from './goals.js';
import type { FieldErrors } from './validation.js';
import { nextGoalDue } from '../goals.js';
import { isReserveItem, reserveRate, suggestedReserve } from '../reserves.js';
import { todayBerlin } from '../dates.js';

export type Reserve = {
	id: string;
	name: string;
	interval: RecurringSummary['interval'];
	customEvery: number | null;
	customUnit: RecurringSummary['customUnit'];
	account: { id: string; name: string; color: string };
	/** Next due item (bank day and amount). */
	next: { date: string; amount: number };
	/** Per month. */
	rate: number;
	/** Should be set aside by now when saving evenly since the previous due date. */
	suggested: number;
	/** Savings goals linked to the item (visible to the viewer). */
	goals: Pick<GoalSummary, 'id' | 'name' | 'allocated' | 'targetAmount' | 'progress'>[];
};

/** Expenses paid every three months or less often, with monthly rate and linked goals. */
export async function listReservesFor(viewer: Viewer): Promise<Reserve[]> {
	const today = todayBerlin();
	const [items, goals] = await Promise.all([listRecurringFor(viewer), listGoalsFor(viewer)]);
	const out: Reserve[] = [];
	for (const i of items) {
		if (i.archivedAt || i.account.archivedAt || i.account.type !== 'giro' || !isReserveItem(i))
			continue;
		const next = nextGoalDue(i, i.amounts, today, new Set());
		if (!next) continue;
		out.push({
			id: i.id,
			name: i.name,
			interval: i.interval,
			customEvery: i.customEvery,
			customUnit: i.customUnit,
			account: { id: i.account.id, name: i.account.name, color: i.account.color },
			next: { date: next.bookingDate, amount: next.amount },
			rate: reserveRate(next.amount, i),
			suggested: suggestedReserve(next.amount, i, next.dueDate, today),
			goals: goals
				.filter((g) => g.recurringId === i.id && !g.done)
				.map((g) => ({
					id: g.id,
					name: g.name,
					allocated: g.allocated,
					targetAmount: g.targetAmount,
					progress: g.progress
				}))
		});
	}
	return out.sort(
		(a, b) => a.next.date.localeCompare(b.next.date) || a.name.localeCompare(b.name, 'de')
	);
}

export type ReserveInput = {
	recurringId: string;
	accountId: string;
	name: string;
	allocated: string;
	/** "on" = also create a monthly transfer giro → savings account. */
	withTransfer: string;
	sourceAccountId: string;
	transferAmount: string;
	transferStart: string;
};

/**
 * "Als Sparziel anlegen": a savings goal for the item (target = next amount) and, on request,
 * a monthly standing order from a giro account to the savings account.
 */
export async function createReserve(
	actor: NonNullable<Actor> & Viewer,
	input: ReserveInput
): Promise<{ errors: FieldErrors } | { name: string }> {
	const today = todayBerlin();
	const reserve = (await listReservesFor(actor)).find((r) => r.id === input.recurringId);
	if (!reserve) return { errors: { name: 'Für diesen Dauerposten gibt es keine Rücklage.' } };
	const account = (await goalAccounts(actor)).find((a) => a.id === input.accountId);
	if (!account) return { errors: { accountId: 'Bitte ein Sparbuch wählen.' } };

	const goalInput: GoalInput = {
		name: input.name,
		targetAmount: '',
		targetDate: '',
		recurringId: reserve.id,
		allocated: input.allocated
	};
	const { free } = await freeOf(account);
	const goal = validateGoal(goalInput, {
		today,
		free,
		payments: new Map([[reserve.id, { amount: reserve.next.amount, next: reserve.next.date }]])
	});
	const errors: FieldErrors = { ...(goal.errors ?? {}) };

	let transfer: Parameters<typeof createRecurring>[1] | null = null;
	let amount = 0;
	if (input.withTransfer === 'on') {
		const { ctx } = await recurringFormContext(actor);
		const r = validateRecurring(
			{
				accountId: input.sourceAccountId,
				kind: 'transfer',
				targetAccountId: account.id,
				name: `Rücklage ${input.name.trim()}`.slice(0, 60),
				counterparty: '',
				iban: '',
				mandateReference: '',
				creditorId: '',
				categoryId: '',
				interval: 'monthly',
				customEvery: '',
				customUnit: '',
				startDate: input.transferStart,
				endDate: '',
				variable: false,
				isSalary: false,
				paymentMethod: 'standing_order',
				customerNumber: '',
				note: ''
			},
			{ ...ctx, transferSourceIds: ctx.accountIds }
		);
		if (r.errors?.accountId || r.errors?.targetAccountId)
			errors.sourceAccountId = 'Von diesem Girokonto darfst du nicht umbuchen.';
		if (!isValidDate(input.transferStart)) errors.transferStart = 'Bitte ein Datum wählen.';
		else if (input.transferStart < today)
			errors.transferStart = 'Die erste Umbuchung darf nicht in der Vergangenheit liegen.';
		const a = validateAmount({ amount: input.transferAmount, validFrom: input.transferStart });
		if (a.errors?.amount) errors.transferAmount = a.errors.amount;
		if (r.values && a.values) {
			transfer = r.values;
			amount = a.values.amount;
		} else if (!Object.keys(errors).length) errors.transferStart = 'Bitte die Angaben prüfen.';
	}
	if (Object.keys(errors).length || !goal.values) return { errors };

	await createGoal(actor, account.id, goal.values);
	if (transfer) await createRecurring(actor, transfer, amount);
	return { name: goal.values.name };
}
