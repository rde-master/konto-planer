import {
	MAX_CONDITIONS,
	RULE_FIELDS,
	RULE_OPERATORS,
	type Condition,
	type RuleField,
	type RuleOperator
} from '../rules.js';
import { normalizeIban } from '../iban.js';
import type { FieldErrors } from './validation.js';

type ConditionInput = { field: string; operator: string; value: string };
export type RuleInput = ConditionInput & {
	categoryId: string;
	/** Further conditions; entries without a text are left out. */
	more?: ConditionInput[];
};
export type RuleValues = {
	field: RuleField;
	operator: RuleOperator;
	value: string;
	/** Further conditions that must hold as well. */
	moreConditions: Condition[];
	categoryId: string;
};

function clean(field: RuleField | undefined, value: string): string {
	const text = value.trim().replace(/\s+/g, ' ');
	return field === 'iban' ? normalizeIban(text) : text;
}

export function validateRule(
	input: RuleInput,
	ctx: { categoryIds: Set<string> }
): { values: RuleValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const field = RULE_FIELDS.find((f) => f === input.field);
	if (!field) errors.field = 'Bitte ein Feld wählen.';
	const operator = RULE_OPERATORS.find((o) => o === input.operator);
	if (!operator) errors.operator = 'Bitte eine Bedingung wählen.';
	const value = clean(field, input.value);
	if (!value) errors.value = 'Bitte einen Text eingeben.';
	else if (value.length > 100) errors.value = 'Höchstens 100 Zeichen.';

	const moreConditions: Condition[] = [];
	for (const m of input.more ?? []) {
		const f = RULE_FIELDS.find((x) => x === m.field);
		const o = RULE_OPERATORS.find((x) => x === m.operator);
		const v = clean(f, m.value);
		// A row left empty is no condition.
		if (!v) continue;
		if (!f || !o) errors.more = 'Bitte bei jeder weiteren Bedingung Feld und Bedingung wählen.';
		else if (v.length > 100) errors.more = 'Höchstens 100 Zeichen je Bedingung.';
		else moreConditions.push({ field: f, operator: o, value: v });
	}
	if (moreConditions.length > MAX_CONDITIONS - 1)
		errors.more = `Höchstens ${MAX_CONDITIONS} Bedingungen je Regel.`;

	if (!ctx.categoryIds.has(input.categoryId)) errors.categoryId = 'Bitte eine Kategorie wählen.';
	if (Object.keys(errors).length || !field || !operator) return { values: null, errors };
	return {
		values: { field, operator, value, moreConditions, categoryId: input.categoryId },
		errors: null
	};
}
