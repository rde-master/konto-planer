// Category rules for imports: one condition each, the first match by position wins.
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
