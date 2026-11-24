// Loans ("Darlehen") repaid by a recurring expense; see docs/PLAN.md.
import { amountOn, dueDates, type AmountEntry, type Schedule } from './recurring.js';

/** Days between two dates by the 30/360 convention (German method, 30E/360). */
export function days360(from: string, to: string): number {
	const [y1, m1, d1] = from.split('-').map(Number) as [number, number, number];
	const [y2, m2, d2] = to.split('-').map(Number) as [number, number, number];
	return (y2 - y1) * 360 + (m2 - m1) * 30 + (Math.min(d2, 30) - Math.min(d1, 30));
}

export type LoanRow = {
	date: string;
	/** Installment paid (the last one may be smaller); 0 for an extra repayment row. */
	payment: number;
	interest: number;
	/** Repaid (negative if the installment does not cover the interest). */
	repayment: number;
	/** Extra repayment on this day. */
	extra: number;
	/** Remaining debt after the row. */
	balance: number;
};

export type LoanPlan = {
	rows: LoanRow[];
	/** Day of the last installment if the loan is paid off within the horizon. */
	paidOff: string | null;
	/** Amount of the last installment. */
	lastPayment: number | null;
	totalInterest: number;
	/** Installments do not cover the interest: the debt grows. */
	growing: boolean;
};

export type LoanInput = {
	principal: number;
	/** Thousandths of a percent per year. */
	rate: number;
	startDate: string;
	installments: { date: string; amount: number }[];
	extras: { date: string; amount: number }[];
};

/**
 * Repayment plan: interest accrues 30/360 on the remaining debt and is due with each
 * installment; the rest of the installment repays the debt. Extra repayments lower the debt on
 * their day. Stops when the debt is paid; the last installment is only what is left.
 */
export function loanPlan(input: LoanInput): LoanPlan {
	const events = [
		...input.installments
			.filter((i) => i.date > input.startDate)
			.map((i) => ({ ...i, extra: false })),
		...input.extras.filter((e) => e.date >= input.startDate).map((e) => ({ ...e, extra: true }))
	].sort((a, b) => a.date.localeCompare(b.date) || Number(b.extra) - Number(a.extra));
	const yearly = input.rate / 100_000;
	let balance = input.principal;
	let accrued = 0;
	let last = input.startDate;
	let totalInterest = 0;
	let growing = false;
	const rows: LoanRow[] = [];
	for (const e of events) {
		if (balance <= 0) break;
		accrued += (balance * yearly * days360(last, e.date)) / 360;
		last = e.date;
		if (e.extra) {
			const extra = Math.min(e.amount, balance);
			balance -= extra;
			rows.push({ date: e.date, payment: 0, interest: 0, repayment: 0, extra, balance });
			continue;
		}
		const interest = Math.round(accrued);
		accrued = 0;
		totalInterest += interest;
		const payment = Math.min(e.amount, balance + interest);
		const repayment = payment - interest;
		if (repayment <= 0) growing = true;
		balance -= repayment;
		rows.push({ date: e.date, payment, interest, repayment, extra: 0, balance });
	}
	const paidOff = balance <= 0 ? (rows.at(-1)?.date ?? null) : null;
	const lastInstallment = [...rows].reverse().find((r) => r.payment > 0);
	return {
		rows,
		paidOff,
		lastPayment: paidOff ? (lastInstallment?.payment ?? null) : null,
		totalInterest,
		growing
	};
}

/** Remaining debt at the end of `day`. */
export function balanceOn(plan: LoanPlan, principal: number, day: string): number {
	let balance = principal;
	for (const r of plan.rows) {
		if (r.date > day) break;
		balance = r.balance;
	}
	return Math.max(0, balance);
}

/** Interest paid with the installments up to `day`. */
export function interestUntil(plan: LoanPlan, day: string): number {
	return plan.rows.filter((r) => r.date <= day).reduce((s, r) => s + r.interest, 0);
}

/**
 * Installments of the item (schedule dates, planned amounts) from the loan start on; an end
 * date of the item ends them (a remaining debt is then shown).
 */
export function installmentsOf(
	item: Schedule,
	amounts: AmountEntry[],
	startDate: string,
	limit = 1200
): { date: string; amount: number }[] {
	return dueDates(item, startDate, '2199-12-31', limit)
		.map((date) => ({ date, amount: amountOn(amounts, date) ?? 0 }))
		.filter((i) => i.amount > 0);
}

/** Loan data with its computed plan, as shown on the recurring item. */
export type LoanInfo = {
	principal: number;
	/** Thousandths of a percent. */
	rate: number;
	startDate: string;
	termEnd: string | null;
	extras: { id: string; date: string; amount: number }[];
	/** Remaining debt today. */
	balance: number;
	/** Share repaid, 0..1. */
	repaid: number;
	paidOff: string | null;
	lastPayment: number | null;
	totalInterest: number;
	interestSoFar: number;
	/** Remaining debt at the end of the term (only if not paid off by then). */
	termEndBalance: number | null;
	growing: boolean;
	/** Next installments with interest and repayment. */
	next: { date: string; payment: number; interest: number; repayment: number; balance: number }[];
	/** Remaining debt over time (for the chart). */
	series: [string, number][];
};
