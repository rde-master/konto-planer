import { describe, expect, it } from 'vitest';
import {
	categoryByRules,
	conditionMatches,
	ruleLabel,
	ruleMatches,
	sameConditions,
	suggestedRule,
	type Rule
} from './rules';
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
			moreConditions: [],
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

describe('rules with several conditions', () => {
	const card = {
		counterparty: null,
		purpose: 'APPLE.COM/BILL IRL CORK EUR 3,49 Umsatz vom 24.11.2026 MC Hauptkarte',
		iban: null,
		bookingText: 'Basislastschrift',
		bankCategory: 'Technik'
	};
	const rule: Rule = {
		field: 'purpose',
		operator: 'contains',
		value: 'apple.com/bill',
		moreConditions: [
			{ field: 'booking_text', operator: 'equals', value: 'basislastschrift' },
			{ field: 'bank_category', operator: 'equals', value: 'Technik' }
		],
		categoryId: 'abos'
	};

	it('match the bank’s booking text and category', () => {
		expect(
			conditionMatches(
				{ field: 'booking_text', operator: 'equals', value: 'Basislastschrift' },
				card
			)
		).toBe(true);
		expect(
			conditionMatches({ field: 'bank_category', operator: 'starts_with', value: 'tech' }, card)
		).toBe(true);
		// A manual booking has neither.
		expect(
			conditionMatches(
				{ field: 'booking_text', operator: 'equals', value: 'Basislastschrift' },
				{ counterparty: 'Apple', purpose: null, iban: null }
			)
		).toBe(false);
	});

	it('apply only if all conditions hold', () => {
		expect(ruleMatches(rule, card)).toBe(true);
		expect(ruleMatches(rule, { ...card, bankCategory: 'Freizeit' })).toBe(false);
		expect(ruleMatches(rule, { ...card, bookingText: 'Gutschrift' })).toBe(false);
		expect(ruleMatches(rule, { ...card, purpose: 'Spotify' })).toBe(false);
		expect(categoryByRules([rule], card)).toBe('abos');
		expect(categoryByRules([rule], { ...card, bankCategory: null })).toBeNull();
	});

	it('never match with a condition they do not know', () => {
		const odd = { ...rule, moreConditions: [{ field: 'colour', operator: 'equals', value: 'x' }] };
		expect(ruleMatches(odd, card)).toBe(false);
		const how = { ...rule, moreConditions: [{ field: 'purpose', operator: 'sounds', value: 'a' }] };
		expect(ruleMatches(how, card)).toBe(false);
	});

	it('are named with all their conditions', () => {
		expect(ruleLabel(rule)).toBe(
			'Verwendungszweck enthält „apple.com/bill“ und Buchungstext ist gleich „basislastschrift“ und Kategorie der Bank ist gleich „Technik“'
		);
	});

	it('are the same with the same conditions in any order', () => {
		const swapped: Rule = {
			field: 'bank_category',
			operator: 'equals',
			value: 'technik',
			moreConditions: [
				{ field: 'purpose', operator: 'contains', value: 'APPLE.COM/BILL' },
				{ field: 'booking_text', operator: 'equals', value: 'Basislastschrift' }
			],
			categoryId: null
		};
		expect(sameConditions(rule, swapped)).toBe(true);
		expect(sameConditions(rule, { ...rule, moreConditions: [] })).toBe(false);
		expect(sameConditions(rule, { ...swapped, value: 'Freizeit' })).toBe(false);
	});
});

describe('validateRule with further conditions', () => {
	const ctx = { categoryIds: new Set(['c1']) };
	const base = { field: 'purpose', operator: 'contains', value: 'Miete', categoryId: 'c1' };

	it('keeps the complete ones and drops empty rows', () => {
		const { values } = validateRule(
			{
				...base,
				more: [
					{ field: 'booking_text', operator: 'equals', value: ' Lastschrift ' },
					{ field: 'bank_category', operator: 'equals', value: '  ' },
					{ field: 'iban', operator: 'equals', value: 'de89 3704' }
				]
			},
			ctx
		);
		expect(values?.moreConditions).toEqual([
			{ field: 'booking_text', operator: 'equals', value: 'Lastschrift' },
			{ field: 'iban', operator: 'equals', value: 'DE893704' }
		]);
		expect(validateRule(base, ctx).values?.moreConditions).toEqual([]);
	});

	it('rejects unknown fields and too many conditions', () => {
		expect(
			validateRule({ ...base, more: [{ field: 'x', operator: 'equals', value: 'a' }] }, ctx).errors
				?.more
		).toBeTruthy();
		const five = Array.from({ length: 5 }, (_, i) => ({
			field: 'purpose',
			operator: 'contains',
			value: `a${i}`
		}));
		expect(validateRule({ ...base, more: five }, ctx).errors?.more).toContain('Höchstens 5');
		expect(validateRule({ ...base, more: five.slice(0, 4) }, ctx).errors).toBeNull();
	});
});
