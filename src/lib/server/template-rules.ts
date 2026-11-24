import { parseEuro } from '../money.js';
import { BOOKING_KINDS, type BookingKind } from './booking-rules.js';
import type { Viewer } from './account-rules.js';
import type { FieldErrors } from './validation.js';

export type TemplateInput = {
	name: string;
	kind: string;
	amount: string;
	accountId: string;
	categoryId: string;
	counterparty: string;
	/** "on" = shared with all users. */
	shared: string;
};

export type TemplateValues = {
	name: string;
	kind: BookingKind;
	/** Positive cents or null (the quick entry then asks for the amount). */
	amount: number | null;
	/** Null = the account used last on the device. */
	accountId: string | null;
	categoryId: string | null;
	counterparty: string | null;
	shared: boolean;
};

export type TemplateContext = {
	/** Giro accounts the user may book on. */
	accountIds: Set<string>;
	categoryIds: Set<string>;
	/** Account of the template being changed: kept even if the editor cannot book on it. */
	currentAccountId?: string | null;
};

type Owned = { ownerId: string | null };

/** Own templates belong to their owner; shared ones may be changed by every user. */
export function canEditTemplate(viewer: Viewer, t: Owned): boolean {
	return t.ownerId === null || t.ownerId === viewer.id;
}

/** Like categories: shared templates are only deleted by the admin. */
export function canDeleteTemplate(viewer: Viewer, t: Owned): boolean {
	return t.ownerId === viewer.id || (t.ownerId === null && viewer.role === 'admin');
}

/** Making a shared template personal removes it for everyone else, so only the admin may. */
export function canUnshareTemplate(viewer: Viewer): boolean {
	return viewer.role === 'admin';
}

function text(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}

export function validateTemplate(
	input: TemplateInput,
	ctx: TemplateContext
): { values: TemplateValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const name = text(input.name);
	if (!name) errors.name = 'Bitte einen Namen eingeben.';
	else if (name.length > 30) errors.name = 'Höchstens 30 Zeichen.';

	const kind = BOOKING_KINDS.find((k) => k === input.kind);
	if (!kind) errors.kind = 'Bitte Ausgabe oder Einnahme wählen.';

	let amount: number | null = null;
	if (input.amount.trim()) {
		amount = parseEuro(input.amount);
		if (amount === null || amount <= 0)
			errors.amount = 'Bitte einen Betrag größer 0 eingeben oder das Feld leer lassen.';
	}

	const accountId = input.accountId || null;
	if (accountId && !ctx.accountIds.has(accountId) && accountId !== ctx.currentAccountId)
		errors.accountId = 'Auf diesem Konto darfst du nicht buchen.';

	const categoryId = input.categoryId || null;
	if (categoryId && !ctx.categoryIds.has(categoryId))
		errors.categoryId = 'Diese Kategorie gibt es nicht mehr.';

	const counterparty = text(input.counterparty) || null;
	if (counterparty && counterparty.length > 70) errors.counterparty = 'Höchstens 70 Zeichen.';

	if (Object.keys(errors).length || !kind) return { values: null, errors };
	return {
		values: {
			name,
			kind,
			amount,
			accountId,
			categoryId,
			counterparty,
			shared: input.shared === 'on'
		},
		errors: null
	};
}

/**
 * New order after moving the template `id` one step up or down within its list
 * (own or shared). Returns the ids in their new order, or null if nothing moves.
 */
export function moveInOrder(ids: string[], id: string, direction: 'up' | 'down'): string[] | null {
	const i = ids.indexOf(id);
	const j = direction === 'up' ? i - 1 : i + 1;
	if (i < 0 || j < 0 || j >= ids.length) return null;
	const next = [...ids];
	[next[i], next[j]] = [next[j], next[i]];
	return next;
}
