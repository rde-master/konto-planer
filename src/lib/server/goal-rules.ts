import { formatEuro, parseEuro } from '../money.js';
import { isValidDate } from './recurring-rules.js';
import type { FieldErrors } from './validation.js';

export type GoalInput = {
	name: string;
	targetAmount: string;
	targetDate: string;
	recurringId: string;
	allocated: string;
};

export type GoalValues = {
	name: string;
	targetAmount: number;
	/** Only without a linked payment. */
	targetDate: string | null;
	recurringId: string | null;
	allocated: number;
};

export type LinkablePayment = {
	/** Amount of the next due item (suggested target amount). */
	amount: number | null;
	/** Next due date; null = the payment has no more due dates. */
	next: string | null;
};

export type GoalContext = {
	today: string;
	/** Expenses on giro accounts the user can see and that may be linked. */
	payments: Map<string, LinkablePayment>;
	/** Balance of the savings account minus what other goals have set aside. */
	free: number;
};

function text(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}

/** The amount set aside: 0 … min(free, target). Returns an error message or the cents. */
export function validateAllocation(
	input: string,
	ctx: { free: number; target: number }
): { value: number; error: null } | { value: null; error: string } {
	const value = input.trim() ? parseEuro(input) : 0;
	if (value === null || value < 0)
		return { value: null, error: 'Bitte einen Betrag ab 0 eingeben.' };
	if (value > ctx.target) return { value: null, error: 'Höchstens der Zielbetrag.' };
	if (value > Math.max(0, ctx.free))
		return {
			value: null,
			error: `Auf dem Sparbuch sind nur ${formatEuro(Math.max(0, ctx.free))} frei.`
		};
	return { value, error: null };
}

export function validateGoal(
	input: GoalInput,
	ctx: GoalContext
): { values: GoalValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const name = text(input.name);
	if (!name) errors.name = 'Bitte einen Namen eingeben.';
	else if (name.length > 60) errors.name = 'Höchstens 60 Zeichen.';

	const recurringId = input.recurringId || null;
	const payment = recurringId ? ctx.payments.get(recurringId) : undefined;
	if (recurringId && !payment) errors.recurringId = 'Diese Zahlung lässt sich nicht verknüpfen.';
	else if (payment && !payment.next) errors.recurringId = 'Die Zahlung hat keine Fälligkeit mehr.';

	let targetAmount: number | null = null;
	if (input.targetAmount.trim()) {
		targetAmount = parseEuro(input.targetAmount);
		if (targetAmount === null || targetAmount <= 0)
			errors.targetAmount = 'Bitte einen Betrag größer 0 eingeben.';
	} else if (payment?.amount) targetAmount = payment.amount;
	else errors.targetAmount = 'Bitte einen Zielbetrag eingeben.';

	let targetDate: string | null = null;
	if (!recurringId && input.targetDate) {
		if (!isValidDate(input.targetDate)) errors.targetDate = 'Bitte ein Datum wählen.';
		else if (input.targetDate < ctx.today)
			errors.targetDate = 'Das Zieldatum darf nicht in der Vergangenheit liegen.';
		else targetDate = input.targetDate;
	}

	let allocated = 0;
	if (targetAmount !== null && targetAmount > 0) {
		const a = validateAllocation(input.allocated, { free: ctx.free, target: targetAmount });
		if (a.error !== null) errors.allocated = a.error;
		else allocated = a.value;
	}

	if (Object.keys(errors).length || targetAmount === null) return { values: null, errors };
	return { values: { name, targetAmount, targetDate, recurringId, allocated }, errors: null };
}
