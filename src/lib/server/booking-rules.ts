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

export type AdjustmentInput = { actual: string; date: string };
export type AdjustmentValues = { actual: number; date: string };

/** Validates "Kontostand korrigieren": the actual balance at the end of a day. */
export function validateAdjustment(
	input: AdjustmentInput,
	ctx: { today: string; openingDate: string }
): { values: AdjustmentValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const actual = parseEuro(input.actual);
	if (actual === null) errors.actual = 'Bitte einen Betrag wie 1.234,56 eingeben (minus für Soll).';
	if (!isValidDate(input.date)) errors.date = 'Bitte ein Datum wählen.';
	else if (input.date > ctx.today) errors.date = 'Das Datum darf nicht in der Zukunft liegen.';
	else if (input.date < ctx.openingDate)
		errors.date = 'Das Datum darf nicht vor dem Startsaldo liegen.';
	if (Object.keys(errors).length || actual === null) return { values: null, errors };
	return { values: { actual, date: input.date }, errors: null };
}
