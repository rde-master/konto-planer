// Category rules for imports: one condition each, the first match by position wins.
import { payeePrefix } from './payee-name.js';

export const RULE_FIELDS = [
	'counterparty',
	'purpose',
	'iban',
	'booking_text',
	'bank_category'
] as const;
export type RuleField = (typeof RULE_FIELDS)[number];
export const RULE_OPERATORS = ['contains', 'equals', 'starts_with'] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

export const RULE_FIELD_LABELS: Record<RuleField, string> = {
	counterparty: 'Empfänger/Zahler',
	purpose: 'Verwendungszweck',
	iban: 'IBAN',
	booking_text: 'Buchungstext',
	bank_category: 'Kategorie der Bank'
};

export const RULE_OPERATOR_LABELS: Record<RuleOperator, string> = {
	contains: 'enthält',
	equals: 'ist gleich',
	starts_with: 'beginnt mit'
};

/** One condition of a rule. */
export type Condition = { field: RuleField; operator: RuleOperator; value: string };

/** A rule has at most this many conditions (the first plus the further ones). */
export const MAX_CONDITIONS = 5;

/**
 * A rule: its first condition, optionally further ones (`moreConditions`) – all of them must
 * hold – and the category it sets.
 */
export type Rule = Condition & {
	/** As stored: entries with an unknown field or operator never match. */
	moreConditions?: { field: string; operator: string; value: string }[] | null;
	categoryId: string | null;
};

export type RuleSubject = {
	counterparty: string | null;
	purpose: string | null;
	/** Normalised IBAN of the payee. */
	iban: string | null;
	/** "Buchungstext" of the bank ("Lastschrift", "Kartenzahlung"). */
	bookingText?: string | null;
	/** Category of the bank export. */
	bankCategory?: string | null;
};

function subjectText(subject: RuleSubject, field: RuleField): string | null {
	switch (field) {
		case 'booking_text':
			return subject.bookingText ?? null;
		case 'bank_category':
			return subject.bankCategory ?? null;
		default:
			return subject[field];
	}
}

function normalize(field: string, value: string): string {
	return value
		.toLowerCase()
		.replace(/\s+/g, field === 'iban' ? '' : ' ')
		.trim();
}

/** All conditions of a rule, the first one first. */
export function ruleConditions(
	rule: Omit<Rule, 'categoryId'>
): { field: string; operator: string; value: string }[] {
	return [
		{ field: rule.field, operator: rule.operator, value: rule.value },
		...(rule.moreConditions ?? [])
	];
}

/** Whether one condition holds (case and repeated spaces ignored; IBAN without spaces). */
export function conditionMatches(
	condition: { field: string; operator: string; value: string },
	subject: RuleSubject
): boolean {
	const field = RULE_FIELDS.find((f) => f === condition.field);
	if (!field) return false;
	const text = subjectText(subject, field);
	if (!text) return false;
	const hay = normalize(field, text);
	const needle = normalize(field, condition.value);
	if (!needle) return false;
	if (condition.operator === 'equals') return hay === needle;
	if (condition.operator === 'starts_with') return hay.startsWith(needle);
	return condition.operator === 'contains' && hay.includes(needle);
}

/** Whether the rule applies: every one of its conditions holds. */
export function ruleMatches(rule: Omit<Rule, 'categoryId'>, subject: RuleSubject): boolean {
	return ruleConditions(rule).every((c) => conditionMatches(c, subject));
}

/** Category of the first matching rule that still has a category (rules sorted by position). */
export function categoryByRules(rules: Rule[], subject: RuleSubject): string | null {
	for (const rule of rules)
		if (rule.categoryId && ruleMatches(rule, subject)) return rule.categoryId;
	return null;
}

function conditionLabel(c: { field: string; operator: string; value: string }): string {
	const field = RULE_FIELD_LABELS[c.field as RuleField] ?? c.field;
	const operator = RULE_OPERATOR_LABELS[c.operator as RuleOperator] ?? c.operator;
	return `${field} ${operator} „${c.value}“`;
}

/** "Verwendungszweck enthält „Miete“", further conditions joined with "und". */
export function ruleLabel(rule: Omit<Rule, 'categoryId'>): string {
	return ruleConditions(rule).map(conditionLabel).join(' und ');
}

/** The same conditions, in any order (case and spaces ignored)? */
export function sameConditions(a: Omit<Rule, 'categoryId'>, b: Omit<Rule, 'categoryId'>): boolean {
	const keys = (rule: Omit<Rule, 'categoryId'>) =>
		ruleConditions(rule)
			.map((c) => `${c.field}|${c.operator}|${normalize(c.field, c.value)}`)
			.sort();
	const x = keys(a);
	const y = keys(b);
	return x.length === y.length && x.every((k, i) => k === y[i]);
}

/** Where the text of a card payment stops being the shop: currency and amount, purchase day. */
const PURPOSE_TAIL = /\s(?:[A-Z]{3}\s+\d[\d.,]*|Umsatz vom|Kartenzahlung|Karte\s\d).*$/i;

/**
 * Rule proposed for "Immer so einordnen" at a booking: the payee as the bank names it (up to
 * the first date or number), or – card statements have no payee – the shop at the start of the
 * purpose ("APPLE.COM/BILL IRL CORK EUR 3,49 Umsatz vom …" → "APPLE.COM/BILL IRL CORK").
 * Null if the booking has neither.
 */
export function suggestedRule(subject: {
	counterparty: string | null;
	purpose: string | null;
}): Pick<Rule, 'field' | 'operator' | 'value'> | null {
	const clip = (text: string) => text.slice(0, 100).trim();
	if (subject.counterparty?.trim()) {
		const value = clip(payeePrefix(subject.counterparty));
		return value ? { field: 'counterparty', operator: 'contains', value } : null;
	}
	const purpose = (subject.purpose ?? '').replace(/\s+/g, ' ').trim();
	if (!purpose) return null;
	const value = clip(payeePrefix(purpose.replace(PURPOSE_TAIL, '')));
	return value ? { field: 'purpose', operator: 'contains', value } : null;
}
