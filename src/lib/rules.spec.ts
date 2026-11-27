import { describe, expect, it } from 'vitest';
import { categoryByRules, ruleLabel, ruleMatches, suggestedRule, type Rule } from './rules';
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

describe('suggestedRule', () => {
	const matches = (subject: { counterparty: string | null; purpose: string | null }) => {
		const rule = suggestedRule(subject)!;
		return ruleMatches(rule, { ...subject, iban: null });
	};

	it('takes the payee up to the first date or number', () => {
		expect(suggestedRule({ counterparty: 'NETFLIX.COM 24.11.', purpose: 'Abo' })).toEqual({
			field: 'counterparty',
			operator: 'contains',
			value: 'NETFLIX.COM'
		});
		expect(suggestedRule({ counterparty: 'REWE 4711 Markt', purpose: null })?.value).toBe('REWE');
		expect(suggestedRule({ counterparty: 'AMZN Mktp DE*2X4Y67890', purpose: null })?.value).toBe(
			'AMZN Mktp DE'
		);
		expect(suggestedRule({ counterparty: '1&1 Telecom GmbH', purpose: null })?.value).toBe(
			'1&1 Telecom GmbH'
		);
	});

	it('takes the shop from the purpose of a card payment', () => {
		const purpose = 'APPLE.COM/BILL IRL CORK EUR 3,49 Umsatz vom 24.11.2026 MC Hauptkarte';
		expect(suggestedRule({ counterparty: null, purpose })).toEqual({
			field: 'purpose',
			operator: 'contains',
			value: 'APPLE.COM/BILL IRL CORK'
		});
		expect(suggestedRule({ counterparty: ' ', purpose: 'Bäcker Umsatz vom 02.11.' })?.value).toBe(
			'Bäcker'
		);
	});

	it('always proposes a text the booking contains', () => {
		for (const subject of [
			{ counterparty: 'NETFLIX.COM 24.11.', purpose: null },
			{ counterparty: 'REWE 4711 Markt', purpose: null },
			{ counterparty: 'AMZN Mktp DE*2X4Y67890', purpose: null },
			{ counterparty: '4711', purpose: null },
			{ counterparty: null, purpose: 'APPLE.COM/BILL IRL CORK EUR 3,49 Umsatz vom 24.11.2026' },
			{ counterparty: null, purpose: '24.11.2026 Tankstelle' }
		])
			expect(matches(subject)).toBe(true);
	});

	it('has nothing to propose without payee and purpose', () => {
		expect(suggestedRule({ counterparty: null, purpose: null })).toBeNull();
		expect(suggestedRule({ counterparty: '', purpose: '  ' })).toBeNull();
	});
});
