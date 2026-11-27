// Category rules for imports: one condition each, the first match by position wins.
import { payeePrefix } from './payee-name.js';

export const RULE_FIELDS = ['counterparty', 'purpose', 'iban'] as const;
export type RuleField = (typeof RULE_FIELDS)[number];
export const RULE_OPERATORS = ['contains', 'equals', 'starts_with'] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

export const RULE_FIELD_LABELS: Record<RuleField, string> = {
	counterparty: 'Empfänger/Zahler',
	purpose: 'Verwendungszweck',
	iban: 'IBAN'
};

export const RULE_OPERATOR_LABELS: Record<RuleOperator, string> = {
	contains: 'enthält',
	equals: 'ist gleich',
	starts_with: 'beginnt mit'
};

export type Rule = {
	field: RuleField;
	operator: RuleOperator;
	value: string;
	categoryId: string | null;
};

export type RuleSubject = {
	counterparty: string | null;
	purpose: string | null;
	/** Normalised IBAN of the payee. */
	iban: string | null;
};

function normalize(field: RuleField, value: string): string {
	const v = value
		.toLowerCase()
		.replace(/\s+/g, field === 'iban' ? '' : ' ')
		.trim();
	return v;
}

/** Whether the rule's condition holds (case and repeated spaces ignored; IBAN without spaces). */
export function ruleMatches(rule: Omit<Rule, 'categoryId'>, subject: RuleSubject): boolean {
	const text = subject[rule.field];
	if (!text) return false;
	const hay = normalize(rule.field, text);
	const needle = normalize(rule.field, rule.value);
	if (!needle) return false;
	if (rule.operator === 'equals') return hay === needle;
	if (rule.operator === 'starts_with') return hay.startsWith(needle);
	return hay.includes(needle);
}

/** Category of the first matching rule that still has a category (rules sorted by position). */
export function categoryByRules(rules: Rule[], subject: RuleSubject): string | null {
	for (const rule of rules)
		if (rule.categoryId && ruleMatches(rule, subject)) return rule.categoryId;
	return null;
}

/** "Verwendungszweck enthält „Miete“" */
export function ruleLabel(rule: Omit<Rule, 'categoryId'>): string {
	return `${RULE_FIELD_LABELS[rule.field]} ${RULE_OPERATOR_LABELS[rule.operator]} „${rule.value}“`;
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
