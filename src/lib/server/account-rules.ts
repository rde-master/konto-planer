import { parseEuro } from '../money.js';
import { isValidIban, normalizeIban } from '../iban.js';
import { isAccountColor } from '../colors.js';
import type { FieldErrors } from './validation.js';

export const ACCOUNT_TYPES = ['giro', 'sparbuch', 'kreditkarte'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const ACCESS_LEVELS = ['view', 'edit'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export type AccountInput = {
	name: string;
	type: string;
	color: string;
	iban: string;
	openingBalance: string;
	openingDate: string;
	overdraftLimit: string;
	buffer: string;
	settlementAccountId: string;
	statementDay: string;
	debitDay: string;
};

export type AccountValues = {
	name: string;
	type: AccountType;
	color: string;
	iban: string | null;
	openingBalance: number;
	openingDate: string;
	overdraftLimit: number;
	/** Added to the minimum balance (giro only). */
	buffer: number;
	/** Credit cards: giro account, statement and debit day of month. */
	settlementAccountId: string | null;
	statementDay: number | null;
	debitDay: number | null;
};

function validDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** Validates the account form; returns either clean values or field errors. */
export function validateAccount(
	input: AccountInput
): { values: AccountValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const name = input.name.trim();
	if (!name) errors.name = 'Bitte einen Namen angeben.';
	else if (name.length > 60) errors.name = 'Höchstens 60 Zeichen.';

	const type = ACCOUNT_TYPES.find((t) => t === input.type);
	if (!type) errors.type = 'Bitte Girokonto, Sparbuch oder Kreditkarte wählen.';

	if (!isAccountColor(input.color)) errors.color = 'Bitte eine Farbe wählen.';

	const iban = normalizeIban(input.iban);
	if (iban && !isValidIban(iban)) errors.iban = 'Diese IBAN ist ungültig (Prüfziffer oder Länge).';

	const openingBalance = parseEuro(input.openingBalance || '0');
	if (openingBalance === null) errors.openingBalance = 'Bitte einen Betrag wie 1.234,56 eingeben.';

	if (!validDate(input.openingDate)) errors.openingDate = 'Bitte ein Datum wählen.';

	let overdraftLimit = 0;
	if ((type === 'giro' || type === 'kreditkarte') && input.overdraftLimit.trim()) {
		const parsed = parseEuro(input.overdraftLimit);
		if (parsed === null || parsed < 0)
			errors.overdraftLimit = 'Bitte einen positiven Betrag eingeben.';
		else overdraftLimit = parsed;
	}

	let buffer = 0;
	if (type === 'giro' && input.buffer.trim()) {
		const parsed = parseEuro(input.buffer);
		if (parsed === null || parsed < 0) errors.buffer = 'Bitte einen positiven Betrag eingeben.';
		else buffer = parsed;
	}

	let settlementAccountId: string | null = null;
	let statementDay: number | null = null;
	let debitDay: number | null = null;
	if (type === 'kreditkarte') {
		const day = (v: string) => (/^\d{1,2}$/.test(v.trim()) ? Number(v) : NaN);
		statementDay = day(input.statementDay);
		debitDay = day(input.debitDay);
		if (!(statementDay >= 1 && statementDay <= 31))
			errors.statementDay = 'Bitte einen Tag von 1 bis 31 eingeben.';
		if (!(debitDay >= 1 && debitDay <= 31))
			errors.debitDay = 'Bitte einen Tag von 1 bis 31 eingeben.';
		if (!/^[0-9a-f-]{36}$/i.test(input.settlementAccountId))
			errors.settlementAccountId = 'Bitte das Girokonto für die Abbuchung wählen.';
		else settlementAccountId = input.settlementAccountId;
	}

	if (Object.keys(errors).length || !type || openingBalance === null)
		return { values: null, errors };
	return {
		values: {
			name,
			type,
			color: input.color,
			iban: iban || null,
			openingBalance,
			openingDate: input.openingDate,
			overdraftLimit,
			buffer,
			settlementAccountId,
			statementDay,
			debitDay
		},
		errors: null
	};
}

export type Viewer = { id: string; role: 'admin' | 'user' };

/** Effective access of a user to an account; admins always edit. */
export function effectiveLevel(viewer: Viewer, granted: AccessLevel | null): AccessLevel | null {
	if (viewer.role === 'admin') return 'edit';
	return granted;
}

/** Whether account data may be changed now: edit right and not archived. */
export function canEditAccount(level: AccessLevel | null, archived: boolean): boolean {
	return level === 'edit' && !archived;
}
