import { asc, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { loanExtraPayments, loans, recurringAmounts, recurringItems } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { diff } from './audit-rules.js';
import type { Viewer } from './account-rules.js';
import { requireEditable, RecurringError } from './recurring.js';
import { syncDues } from './due.js';
import { isValidDate } from './recurring-rules.js';
import type { FieldErrors } from './validation.js';
import { balanceOn, installmentsOf, interestUntil, loanPlan, type LoanInfo } from '../loans.js';
import { formatRate, parseRate } from '../interest.js';
import { parseEuro } from '../money.js';
import { todayBerlin } from '../dates.js';
import type { RecurringItem } from './db/schema.js';

export type LoanInput = { principal: string; rate: string; startDate: string; termEnd: string };
export type LoanValues = {
	principal: number;
	rate: number;
	startDate: string;
	termEnd: string | null;
};
export type { LoanInfo };

export function validateLoan(
	input: LoanInput
): { values: LoanValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const principal = parseEuro(input.principal);
	if (principal === null || principal <= 0)
		errors.principal = 'Bitte einen Betrag größer 0 eingeben.';
	const rate = parseRate(input.rate);
	if (rate === null) errors.rate = 'Bitte einen Zinssatz wie 3,5 eingeben.';
	if (!isValidDate(input.startDate)) errors.startDate = 'Bitte ein Datum wählen.';
	let termEnd: string | null = null;
	if (input.termEnd) {
		if (!isValidDate(input.termEnd)) errors.termEnd = 'Bitte ein Datum wählen.';
		else if (isValidDate(input.startDate) && input.termEnd <= input.startDate)
			errors.termEnd = 'Das Laufzeitende muss nach dem Beginn liegen.';
		else termEnd = input.termEnd;
	}
	if (Object.keys(errors).length || principal === null || rate === null)
		return { values: null, errors };
	return { values: { principal, rate, startDate: input.startDate, termEnd }, errors: null };
}

export function validateExtra(input: {
	date: string;
	amount: string;
}):
	| { values: { date: string; amount: number }; errors: null }
	| { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const amount = parseEuro(input.amount);
	if (amount === null || amount <= 0) errors.amount = 'Bitte einen Betrag größer 0 eingeben.';
	if (!isValidDate(input.date)) errors.date = 'Bitte ein Datum wählen.';
	if (Object.keys(errors).length || amount === null) return { values: null, errors };
	return { values: { date: input.date, amount }, errors: null };
}

/** Loan data of an item with its computed repayment plan, or null. */
export async function loanInfo(item: RecurringItem): Promise<LoanInfo | null> {
	const [loan] = await db.select().from(loans).where(eq(loans.recurringId, item.id));
	if (!loan) return null;
	const [amounts, extras] = await Promise.all([
		db.select().from(recurringAmounts).where(eq(recurringAmounts.recurringId, item.id)),
		db
			.select()
			.from(loanExtraPayments)
			.where(eq(loanExtraPayments.recurringId, item.id))
			.orderBy(asc(loanExtraPayments.date))
	]);
	const today = todayBerlin();
	const plan = loanPlan({
		principal: loan.principal,
		rate: loan.rate,
		startDate: loan.startDate,
		installments: installmentsOf(
			item,
			amounts
				.map(({ amount, validFrom }) => ({ amount, validFrom }))
				.sort((a, b) => a.validFrom.localeCompare(b.validFrom)),
			loan.startDate
		),
		extras
	});
	const balance = balanceOn(plan, loan.principal, today);
	const termEndBalance =
		loan.termEnd && (!plan.paidOff || plan.paidOff > loan.termEnd)
			? balanceOn(plan, loan.principal, loan.termEnd)
			: null;
	return {
		principal: loan.principal,
		rate: loan.rate,
		startDate: loan.startDate,
		termEnd: loan.termEnd,
		extras: extras.map(({ id, date, amount }) => ({ id, date, amount })),
		balance,
		repaid: Math.min(1, Math.max(0, 1 - balance / loan.principal)),
		paidOff: plan.paidOff,
		lastPayment: plan.lastPayment,
		totalInterest: plan.totalInterest,
		interestSoFar: interestUntil(plan, today),
		termEndBalance,
		growing: plan.growing,
		next: plan.rows
			.filter((r) => r.date > today && r.payment > 0)
			.slice(0, 6)
			.map(({ date, payment, interest, repayment, balance }) => ({
				date,
				payment,
				interest,
				repayment,
				balance
			})),
		series: [
			[loan.startDate, loan.principal],
			...plan.rows.map((r): [string, number] => [r.date, r.balance])
		]
	};
}

function auditView(v: LoanValues | null) {
	return {
		loanPrincipal: v?.principal ?? null,
		loanRate: v ? formatRate(v.rate) : null,
		loanStart: v?.startDate ?? null,
		loanTermEnd: v?.termEnd ?? null
	};
}

async function requireExpense(viewer: Viewer, id: string) {
	const item = await requireEditable(viewer, id);
	if (item.kind !== 'expense') throw new RecurringError('Darlehen gibt es nur bei Ausgaben.');
	return item;
}

/** Saves the loan data of an expense (creates or changes). */
export async function saveLoan(actor: NonNullable<Actor> & Viewer, id: string, values: LoanValues) {
	const item = await requireExpense(actor, id);
	await db.transaction(async (tx) => {
		const [current] = await tx.select().from(loans).where(eq(loans.recurringId, id));
		if (current)
			await tx
				.update(loans)
				.set({ ...values, updatedAt: new Date() })
				.where(eq(loans.recurringId, id));
		else await tx.insert(loans).values({ ...values, recurringId: id });
		const changes = diff(auditView(current ?? null), auditView(values));
		if (changes)
			await audit(tx, {
				actor,
				entityType: 'recurring',
				action: 'update',
				entityId: id,
				entityLabel: item.name,
				...changes
			});
	});
}

/** Removes the loan data (the expense stays). */
export async function deleteLoan(actor: NonNullable<Actor> & Viewer, id: string) {
	const item = await requireExpense(actor, id);
	await db.transaction(async (tx) => {
		const [deleted] = await tx.delete(loans).where(eq(loans.recurringId, id)).returning();
		if (!deleted) return;
		await audit(tx, {
			actor,
			entityType: 'recurring',
			action: 'update',
			entityId: id,
			entityLabel: item.name,
			before: auditView(deleted),
			after: auditView(null)
		});
	});
}

export async function addExtra(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	extra: { date: string; amount: number }
) {
	const item = await requireExpense(actor, id);
	await db.transaction(async (tx) => {
		const [loan] = await tx.select().from(loans).where(eq(loans.recurringId, id));
		if (!loan) throw new RecurringError('Erst die Darlehensdaten erfassen.');
		if (extra.date < loan.startDate)
			throw new RecurringError('Die Sondertilgung liegt vor dem Beginn des Darlehens.');
		await tx.insert(loanExtraPayments).values({ recurringId: id, ...extra });
		await audit(tx, {
			actor,
			entityType: 'recurring',
			action: 'loan_extra',
			entityId: id,
			entityLabel: item.name,
			after: { date: extra.date, amount: extra.amount }
		});
	});
}

export async function deleteExtra(actor: NonNullable<Actor> & Viewer, id: string, extraId: string) {
	const item = await requireExpense(actor, id);
	await db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(loanExtraPayments)
			.where(eq(loanExtraPayments.id, extraId));
		if (!row || row.recurringId !== id) throw new RecurringError('Sondertilgung nicht gefunden.');
		await tx.delete(loanExtraPayments).where(eq(loanExtraPayments.id, extraId));
		await audit(tx, {
			actor,
			entityType: 'recurring',
			action: 'loan_extra',
			entityId: id,
			entityLabel: item.name,
			before: { date: row.date, amount: row.amount },
			after: null
		});
	});
}

/** "Ende übernehmen": the item ends with the last installment of the loan. */
export async function applyLoanEnd(actor: NonNullable<Actor> & Viewer, id: string) {
	const item = await requireExpense(actor, id);
	const info = await loanInfo(item);
	if (!info?.paidOff) throw new RecurringError('Das Darlehen ist laut Rechnung nicht abbezahlt.');
	if (item.endDate === info.paidOff) return;
	await db.transaction(async (tx) => {
		await tx
			.update(recurringItems)
			.set({ endDate: info.paidOff, updatedAt: new Date() })
			.where(eq(recurringItems.id, id));
		await audit(tx, {
			actor,
			entityType: 'recurring',
			action: 'update',
			entityId: id,
			entityLabel: item.name,
			before: { endDate: item.endDate },
			after: { endDate: info.paidOff }
		});
	});
	await syncDues([id]);
}
