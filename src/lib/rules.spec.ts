import { describe, expect, it } from 'vitest';
import { categoryByRules, ruleLabel, ruleMatches, type Rule } from './rules';
import { validateRule } from './server/rule-rules';

const subject = {
	counterparty: 'Stadtwerke  Musterstadt',
	purpose: 'Abschlag Strom Kd-Nr 4711',
	iban: 'DE89370400440532013000'
};

describe('ruleMatches', () => {
	it('contains, equals, starts with; ignoring case and spaces', () => {
		expect(ruleMatches({ field: 'purpose', operator: 'contains', value: 'STROM' }, subject)).toBe(
			true
		);
		expect(
			ruleMatches(
				{ field: 'counterparty', operator: 'equals', value: 'stadtwerke musterstadt' },
				subject
			)
		).toBe(true);
		expect(
			ruleMatches({ field: 'counterparty', operator: 'equals', value: 'Stadtwerke' }, subject)
		).toBe(false);
		expect(
			ruleMatches({ field: 'iban', operator: 'starts_with', value: 'de89 3704' }, subject)
		).toBe(true);
		expect(ruleMatches({ field: 'purpose', operator: 'contains', value: 'Miete' }, subject)).toBe(
			false
		);
		expect(
			ruleMatches({ field: 'iban', operator: 'contains', value: 'DE' }, { ...subject, iban: null })
		).toBe(false);
	});
});

describe('categoryByRules', () => {
	it('takes the first matching rule with a category', () => {
		const rules: Rule[] = [
			{ field: 'purpose', operator: 'contains', value: 'strom', categoryId: null },
			{
				field: 'counterparty',
				operator: 'starts_with',
				value: 'stadtwerke',
				categoryId: 'energie'
			},
			{ field: 'purpose', operator: 'contains', value: 'abschlag', categoryId: 'sonstiges' }
		];
		expect(categoryByRules(rules, subject)).toBe('energie');
		expect(categoryByRules(rules.slice(2), { ...subject, purpose: null })).toBeNull();
		expect(ruleLabel(rules[0])).toBe('Verwendungszweck enthält „strom“');
	});
});

describe('validateRule', () => {
	const ctx = { categoryIds: new Set(['c1']) };
	it('needs field, operator, text and category; IBANs are normalised', () => {
		expect(
			validateRule({ field: 'iban', operator: 'equals', value: 'de89 3704', categoryId: 'c1' }, ctx)
				.values
		).toEqual({
			field: 'iban',
			operator: 'equals',
			value: 'DE893704',
			categoryId: 'c1'
		});
		const bad = validateRule({ field: 'x', operator: 'y', value: ' ', categoryId: '' }, ctx);
		expect(Object.keys(bad.errors ?? {}).sort()).toEqual([
			'categoryId',
			'field',
			'operator',
			'value'
		]);
	});
});
