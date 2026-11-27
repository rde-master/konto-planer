// "Immer so einordnen" at a booking: a category rule made from the booking's payee, applied
// to the booking itself and to every booking without category the rule fits.
import { and, asc, eq, inArray, isNull, min, ne } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookings, categoryRules } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { listAccountsFor } from './accounts.js';
import { getBookingFor, type BookingSummary } from './bookings.js';
import { categoryInfo } from './categories.js';
import { RuleError } from './rules.js';
import type { RuleValues } from './rule-rules.js';
import {
	RULE_FIELD_LABELS,
	RULE_OPERATOR_LABELS,
	ruleLabel,
	ruleMatches,
	sameConditions,
	suggestedRule,
	type RuleField,
	type RuleOperator
} from '../rules.js';

export type RuleOption = {
	field: RuleField;
	operator: RuleOperator;
	/** "Empfänger/Zahler enthält" */
	label: string;
	/** Text proposed for the rule. */
	value: string;
};

/** Real money on an account the viewer edits: such a booking can set the rule. */
function allowed(b: Pick<BookingSummary, 'canSplit'>): boolean {
	return b.canSplit;
}

/**
 * What a rule for this booking can go by: payee, purpose, IBAN, the bank's booking text and
 * category, each with the proposed text – the proposal of `suggestedRule()` first. Several can
 * be combined; then all must hold. Empty if the booking cannot set a rule.
 */
export function ruleOptions(
	b: Pick<
		BookingSummary,
		'canSplit' | 'counterparty' | 'purpose' | 'iban' | 'bookingText' | 'bankCategory'
	>
): RuleOption[] {
	if (!allowed(b)) return [];
	const option = (field: RuleField, operator: RuleOperator, value: string): RuleOption => ({
		field,
		operator,
		label: `${RULE_FIELD_LABELS[field]} ${RULE_OPERATOR_LABELS[operator]}`,
		value
	});
	const out: RuleOption[] = [];
	const payee = suggestedRule({ counterparty: b.counterparty, purpose: null });
	if (payee) out.push(option('counterparty', 'contains', payee.value));
	const purpose = suggestedRule({ counterparty: null, purpose: b.purpose });
	if (purpose) out.push(option('purpose', 'contains', purpose.value));
	if (b.iban) out.push(option('iban', 'equals', b.iban));
	const clip = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
	if (clip(b.bookingText)) out.push(option('booking_text', 'equals', clip(b.bookingText)));
	if (clip(b.bankCategory)) out.push(option('bank_category', 'equals', clip(b.bankCategory)));
	return out;
}

export type AlwaysResult = {
	/** "Empfänger/Zahler enthält „Netflix“" */
	rule: string;
	category: string;
	/** Other bookings without category that got it. */
	applied: number;
};

/**
 * Creates the rule (or gives an existing rule with the same conditions the category), puts it
 * first so it wins over older rules, sets the category of the booking and of every booking
 * without category the rule fits on accounts the actor may edit.
 */
export async function categorizeAlways(
	actor: NonNullable<Actor> & Viewer,
	bookingId: string,
	values: RuleValues
): Promise<AlwaysResult> {
	const booking = await getBookingFor(actor, bookingId);
	if (!booking) throw new RuleError('Buchung nicht gefunden.');
	if (!allowed(booking)) throw new RuleError('Für diese Buchung lässt sich keine Regel anlegen.');
	if (!ruleMatches(values, booking))
		throw new RuleError(
			'Dieser Text kommt in der Buchung nicht vor – die Regel würde sie nicht treffen.'
		);
	const editable = (await listAccountsFor(actor))
		.filter((a) => canEditAccount(a.level, a.archivedAt !== null))
		.map((a) => a.id);
	return db.transaction(async (tx) => {
		const category = await categoryInfo(tx);
		const nameOf = (id: string | null) => {
			const c = category(id);
			return c ? (c.parentName ? `${c.parentName} › ${c.name}` : c.name) : null;
		};
		const label = ruleLabel(values);
		const rules = await tx.select().from(categoryRules).orderBy(asc(categoryRules.position));
		const same = rules.find((r) => sameConditions(r, values));
		if (same) {
			if (same.categoryId !== values.categoryId) {
				await tx
					.update(categoryRules)
					.set({ categoryId: values.categoryId, updatedAt: new Date() })
					.where(eq(categoryRules.id, same.id));
				await audit(tx, {
					actor,
					entityType: 'rule',
					action: 'update',
					entityId: same.id,
					entityLabel: label,
					before: { category: nameOf(same.categoryId) },
					after: { category: nameOf(values.categoryId) }
				});
			}
		} else {
			const [first] = await tx.select({ p: min(categoryRules.position) }).from(categoryRules);
			const [created] = await tx
				.insert(categoryRules)
				.values({ ...values, position: (first?.p ?? 1) - 1, createdBy: actor.id })
				.returning({ id: categoryRules.id });
			await audit(tx, {
				actor,
				entityType: 'rule',
				action: 'create',
				entityId: created.id,
				entityLabel: label,
				after: { rule: label, category: nameOf(values.categoryId) }
			});
		}

		if (booking.categoryId !== values.categoryId) {
			await tx
				.update(bookings)
				.set({ categoryId: values.categoryId, updatedAt: new Date() })
				.where(eq(bookings.id, booking.id));
			await audit(tx, {
				actor,
				entityType: 'booking',
				action: 'update',
				entityId: booking.id,
				entityLabel: booking.counterparty ?? booking.purpose ?? 'Buchung',
				before: { category: nameOf(booking.categoryId) },
				after: { category: nameOf(values.categoryId) }
			});
		}

		const open = editable.length
			? await tx
					.select({
						id: bookings.id,
						counterparty: bookings.counterparty,
						purpose: bookings.purpose,
						iban: bookings.iban,
						bookingText: bookings.bookingText,
						bankCategory: bookings.bankCategory
					})
					.from(bookings)
					.where(
						and(
							inArray(bookings.accountId, editable),
							inArray(bookings.source, ['manual', 'import']),
							isNull(bookings.categoryId),
							ne(bookings.id, booking.id)
						)
					)
			: [];
		const targets = open.filter((b) => ruleMatches(values, b)).map((b) => b.id);
		if (targets.length) {
			await tx
				.update(bookings)
				.set({ categoryId: values.categoryId, updatedAt: new Date() })
				.where(and(inArray(bookings.id, targets), isNull(bookings.categoryId)));
			await audit(tx, {
				actor,
				entityType: 'rule',
				action: 'apply',
				entityId: null,
				entityLabel: label,
				after: { bookingsCategorized: targets.length }
			});
		}
		return { rule: label, category: nameOf(values.categoryId) ?? '', applied: targets.length };
	});
}
