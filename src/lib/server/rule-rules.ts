import { RULE_FIELDS, RULE_OPERATORS, type RuleField, type RuleOperator } from '../rules.js';
import { normalizeIban } from '../iban.js';
import type { FieldErrors } from './validation.js';

export type RuleInput = { field: string; operator: string; value: string; categoryId: string };
export type RuleValues = {
	field: RuleField;
	operator: RuleOperator;
	value: string;
	categoryId: string;
};

export function validateRule(
	input: RuleInput,
	ctx: { categoryIds: Set<string> }
): { values: RuleValues; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const field = RULE_FIELDS.find((f) => f === input.field);
	if (!field) errors.field = 'Bitte ein Feld wählen.';
	const operator = RULE_OPERATORS.find((o) => o === input.operator);
	if (!operator) errors.operator = 'Bitte eine Bedingung wählen.';
	let value = input.value.trim().replace(/\s+/g, ' ');
	if (field === 'iban') value = normalizeIban(value);
	if (!value) errors.value = 'Bitte einen Text eingeben.';
	else if (value.length > 100) errors.value = 'Höchstens 100 Zeichen.';
	if (!ctx.categoryIds.has(input.categoryId)) errors.categoryId = 'Bitte eine Kategorie wählen.';
	if (Object.keys(errors).length || !field || !operator) return { values: null, errors };
	return { values: { field, operator, value, categoryId: input.categoryId }, errors: null };
}
