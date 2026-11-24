import { parseEuro } from '../money.js';
import { isValidDate } from './recurring-rules.js';
import type { FieldErrors } from './validation.js';

export const BOOKING_KINDS = ['expense', 'income'] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];

export type BookingInput = {
	kind: string;
	amount: string;
	accountId: string;
	categoryId: string;
	bookingDate: string;
	counterparty: string;
	purpose: string;
};

export type BookingValues = {
	accountId: string;
	bookingDate: string;
	/** Signed cents: negative for expenses. */
	amount: number;
	categoryId: string | null;
	counterparty: string | null;
	purpose: string | null;
};

export type BookingContext = {
	/** Giro accounts the user may book on. */
	accountIds: Set<string>;
	categoryIds: Set<string>;
	today: string;
};

function optional(value: string, max: number, field: string, errors: FieldErrors): string | null {
	const v = value.trim().replace(/\s+/g, ' ');
	if (v.length > max) errors[field] = `Höchstens ${max} Zeichen.`;
	return v || null;
}

/** Validates a manual booking. The amount is entered positive; the kind gives the sign. */
export function validateBooking(
	input: BookingInput,
	ctx: BookingContext
): { values: BookingValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const kind = BOOKING_KINDS.find((k) => k === input.kind);
	if (!kind) errors.kind = 'Bitte Ausgabe oder Einnahme wählen.';

	const cents = parseEuro(input.amount);
	if (cents === null || cents <= 0)
		errors.amount = 'Bitte einen Betrag größer 0 eingeben, z. B. 12,50.';

	if (!ctx.accountIds.has(input.accountId)) errors.accountId = 'Bitte ein Konto wählen.';

	const categoryId = input.categoryId || null;
	if (categoryId && !ctx.categoryIds.has(categoryId))
		errors.categoryId = 'Diese Kategorie gibt es nicht mehr.';

	if (!isValidDate(input.bookingDate)) errors.bookingDate = 'Bitte ein Datum wählen.';
	else if (input.bookingDate > ctx.today)
		errors.bookingDate = 'Das Datum darf nicht in der Zukunft liegen.';

	const counterparty = optional(input.counterparty, 70, 'counterparty', errors);
	const purpose = optional(input.purpose, 140, 'purpose', errors);

	if (Object.keys(errors).length || cents === null || !kind) return { values: null, errors };
	return {
		values: {
			accountId: input.accountId,
			bookingDate: input.bookingDate,
			amount: kind === 'expense' ? -cents : cents,
			categoryId,
			counterparty,
			purpose
		},
		errors: null
	};
}
