import { parseEuro } from '../money.js';
import { isValidIban, normalizeIban } from '../iban.js';
import {
	CUSTOM_UNITS,
	INTERVALS,
	PAYMENT_METHODS,
	RECURRING_KINDS,
	TRANSFER_PAYMENT_METHODS,
	type CustomUnit,
	type Interval,
	type PaymentMethod,
	type RecurringKind
} from '../recurring.js';
import { RENEWALS, type Contract } from '../contracts.js';
import type { FieldErrors } from './validation.js';

export type RecurringInput = {
	accountId: string;
	kind: string;
	targetAccountId: string;
	name: string;
	counterparty: string;
	iban: string;
	mandateReference: string;
	creditorId: string;
	categoryId: string;
	interval: string;
	customEvery: string;
	customUnit: string;
	startDate: string;
	endDate: string;
	variable: boolean;
	isSalary: boolean;
	paymentMethod: string;
};

export type RecurringValues = {
	accountId: string;
	kind: RecurringKind;
	targetAccountId: string | null;
	name: string;
	counterparty: string | null;
	iban: string | null;
	mandateReference: string | null;
	creditorId: string | null;
	categoryId: string | null;
	interval: Interval;
	customEvery: number | null;
	customUnit: CustomUnit | null;
	startDate: string;
	endDate: string | null;
	variable: boolean;
	isSalary: boolean;
	paymentMethod: PaymentMethod | null;
};

export function isValidDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** SEPA creditor identifier, normalised (upper case, no spaces). */
export function normalizeCreditorId(raw: string): string {
	return raw.replace(/\s+/g, '').toUpperCase();
}

/**
 * Checks a SEPA creditor identifier: country, two check digits, three-character business
 * code (ignored by the check), national identifier. Check digits per ISO 7064 mod 97-10.
 */
export function isValidCreditorId(id: string): boolean {
	if (!/^[A-Z]{2}\d{2}[A-Z0-9]{3}[A-Z0-9]{1,28}$/.test(id)) return false;
	const rearranged = id.slice(7) + id.slice(0, 2) + id.slice(2, 4);
	const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
	let rest = 0;
	for (const ch of digits) rest = (rest * 10 + Number(ch)) % 97;
	return rest === 1;
}

function optional(value: string, max: number, field: string, errors: FieldErrors): string | null {
	const v = value.trim().replace(/\s+/g, ' ');
	if (v.length > max) errors[field] = `Höchstens ${max} Zeichen.`;
	return v || null;
}

export type RecurringContext = {
	/** Accounts the user may add income and expenses to (giro accounts). */
	accountIds: Set<string>;
	/** Accounts the user may transfer from (giro and savings). */
	transferSourceIds?: Set<string>;
	/** Accounts that may receive a transfer (all active accounts of the app). */
	targetAccountIds?: Set<string>;
	categoryIds: Set<string>;
};

/** Validates the recurring-item form. Transfers have no category and no payee data. */
export function validateRecurring(
	input: RecurringInput,
	ctx: RecurringContext
): { values: RecurringValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};

	const kind = RECURRING_KINDS.find((k) => k === input.kind);
	if (!kind) errors.kind = 'Bitte Ausgabe, Einnahme oder Umbuchung wählen.';
	const transfer = kind === 'transfer';

	const sources = transfer ? (ctx.transferSourceIds ?? new Set()) : ctx.accountIds;
	if (!sources.has(input.accountId)) errors.accountId = 'Bitte ein Konto wählen.';

	let targetAccountId: string | null = null;
	if (transfer) {
		if (!(ctx.targetAccountIds ?? new Set()).has(input.targetAccountId))
			errors.targetAccountId = 'Bitte ein Zielkonto wählen.';
		else if (input.targetAccountId === input.accountId)
			errors.targetAccountId = 'Quell- und Zielkonto müssen verschieden sein.';
		else targetAccountId = input.targetAccountId;
	}

	const name = input.name.trim().replace(/\s+/g, ' ');
	if (!name) errors.name = 'Bitte eine Bezeichnung angeben.';
	else if (name.length > 60) errors.name = 'Höchstens 60 Zeichen.';

	// Transfers know their target account; payee data and category do not apply.
	const counterparty = transfer ? null : optional(input.counterparty, 70, 'counterparty', errors);
	const mandateReference =
		kind === 'expense' ? optional(input.mandateReference, 35, 'mandateReference', errors) : null;

	const iban = transfer ? '' : normalizeIban(input.iban);
	if (iban && !isValidIban(iban)) errors.iban = 'Diese IBAN ist ungültig (Prüfziffer oder Länge).';

	const creditorId = kind === 'expense' ? normalizeCreditorId(input.creditorId) : '';
	if (creditorId && !isValidCreditorId(creditorId))
		errors.creditorId = 'Diese Gläubiger-ID ist ungültig (z. B. DE98ZZZ09999999999).';

	const categoryId = transfer ? null : input.categoryId || null;
	if (categoryId && !ctx.categoryIds.has(categoryId))
		errors.categoryId = 'Diese Kategorie gibt es nicht mehr.';

	const interval = INTERVALS.find((i) => i === input.interval);
	if (!interval) errors.interval = 'Bitte ein Intervall wählen.';

	let customEvery: number | null = null;
	let customUnit: CustomUnit | null = null;
	if (interval === 'custom') {
		const every = Number(input.customEvery);
		if (!/^\d+$/.test(input.customEvery.trim()) || every < 1 || every > 366)
			errors.customEvery = 'Bitte eine Zahl von 1 bis 366 eingeben.';
		else customEvery = every;
		customUnit = CUSTOM_UNITS.find((u) => u === input.customUnit) ?? null;
		if (!customUnit) errors.customUnit = 'Bitte Tage, Wochen oder Monate wählen.';
	}

	if (!isValidDate(input.startDate))
		errors.startDate =
			interval === 'once' ? 'Bitte ein Datum wählen.' : 'Bitte ein Startdatum wählen.';

	let endDate: string | null = null;
	if (interval !== 'once' && input.endDate) {
		if (!isValidDate(input.endDate)) errors.endDate = 'Bitte ein gültiges Datum wählen.';
		else if (input.endDate < input.startDate) errors.endDate = 'Das Ende liegt vor dem Start.';
		else endDate = input.endDate;
	}

	let paymentMethod: PaymentMethod | null = null;
	if ((kind === 'expense' || transfer) && input.paymentMethod) {
		const allowed: readonly PaymentMethod[] = transfer ? TRANSFER_PAYMENT_METHODS : PAYMENT_METHODS;
		paymentMethod = allowed.find((p) => p === input.paymentMethod) ?? null;
		if (!paymentMethod) errors.paymentMethod = 'Bitte eine Zahlart wählen.';
	}

	if (Object.keys(errors).length || !kind || !interval) return { values: null, errors };
	return {
		values: {
			accountId: input.accountId,
			kind,
			targetAccountId,
			name,
			counterparty,
			iban: iban || null,
			mandateReference,
			creditorId: creditorId || null,
			categoryId,
			interval,
			customEvery,
			customUnit,
			startDate: input.startDate,
			endDate,
			variable: input.variable,
			isSalary: kind === 'income' && input.isSalary,
			paymentMethod
		},
		errors: null
	};
}

/** Validates an amount-history entry (amount in euro, positive). */
export function validateAmount(input: {
	amount: string;
	validFrom: string;
}):
	| { values: { amount: number; validFrom: string }; errors: null }
	| { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const amount = parseEuro(input.amount);
	if (amount === null || amount <= 0)
		errors.amount = 'Bitte einen Betrag größer 0 eingeben, z. B. 49,99.';
	if (!isValidDate(input.validFrom)) errors.validFrom = 'Bitte ein Datum wählen.';
	if (Object.keys(errors).length || amount === null) return { values: null, errors };
	return { values: { amount, validFrom: input.validFrom }, errors: null };
}

export type ContractInput = {
	contract: boolean;
	termEnd: string;
	noticeEvery: string;
	noticeUnit: string;
	renewal: string;
	renewalMonths: string;
	leadDays: string;
	cancelledOn: string;
};

function wholeNumber(value: string, min: number, max: number): number | null {
	const v = value.trim();
	if (!/^\d+$/.test(v)) return null;
	const n = Number(v);
	return n >= min && n <= max ? n : null;
}

/**
 * Validates contract data. Only expenses can be cancellable contracts; for other kinds or a
 * switched-off toggle the result is `null` (no contract).
 */
export function validateContract(
	input: ContractInput,
	kind: string
): { values: Contract | null; errors: null } | { values: null; errors: FieldErrors } {
	if (!input.contract || kind !== 'expense') return { values: null, errors: null };
	const errors: FieldErrors = {};

	const renewal = RENEWALS.find((r) => r === input.renewal);
	if (!renewal) errors.renewal = 'Bitte eine Verlängerung wählen.';

	let termEnd: string | null = null;
	if (input.termEnd) {
		if (!isValidDate(input.termEnd)) errors.termEnd = 'Bitte ein gültiges Datum wählen.';
		else termEnd = input.termEnd;
	} else if (renewal && renewal !== 'indefinite')
		errors.termEnd = 'Bitte das Ende der Laufzeit angeben.';

	const noticeEvery = wholeNumber(input.noticeEvery, 0, 366);
	if (noticeEvery === null) errors.noticeEvery = 'Bitte eine Zahl von 0 bis 366 eingeben.';
	const noticeUnit = CUSTOM_UNITS.find((u) => u === input.noticeUnit);
	if (!noticeUnit) errors.noticeUnit = 'Bitte Tage, Wochen oder Monate wählen.';

	let renewalMonths: number | null = null;
	if (renewal === 'period') {
		renewalMonths = wholeNumber(input.renewalMonths, 1, 120);
		if (renewalMonths === null) errors.renewalMonths = 'Bitte 1 bis 120 Monate eingeben.';
	}

	let leadDays: number | null = null;
	if (input.leadDays.trim()) {
		leadDays = wholeNumber(input.leadDays, 0, 365);
		if (leadDays === null) errors.leadDays = 'Bitte 0 bis 365 Tage eingeben.';
	}

	let cancelledOn: string | null = null;
	if (input.cancelledOn) {
		if (!isValidDate(input.cancelledOn)) errors.cancelledOn = 'Bitte ein gültiges Datum wählen.';
		else cancelledOn = input.cancelledOn;
	}

	if (Object.keys(errors).length || !renewal || noticeEvery === null || !noticeUnit)
		return { values: null, errors };
	return {
		values: { termEnd, noticeEvery, noticeUnit, renewal, renewalMonths, leadDays, cancelledOn },
		errors: null
	};
}
