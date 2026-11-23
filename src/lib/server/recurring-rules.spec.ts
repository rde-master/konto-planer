import { describe, expect, it } from 'vitest';
import {
	isValidCreditorId,
	validateAmount,
	validateRecurring,
	type RecurringInput
} from './recurring-rules';

const ctx = { accountIds: new Set(['acc']), categoryIds: new Set(['cat']) };

const valid: RecurringInput = {
	accountId: 'acc',
	kind: 'expense',
	name: '  Strom  ',
	counterparty: 'Stadtwerke  Musterstadt',
	iban: 'de89 3704 0044 0532 0130 00',
	mandateReference: 'MANDAT-123',
	creditorId: 'de98 zzz0 9999 9999 99',
	categoryId: 'cat',
	interval: 'monthly',
	customEvery: '',
	customUnit: '',
	startDate: '2026-01-15',
	endDate: '',
	variable: true,
	isSalary: true,
	paymentMethod: 'direct_debit'
};

describe('isValidCreditorId', () => {
	it('checks the mod 97 check digits and ignores the business code', () => {
		expect(isValidCreditorId('DE98ZZZ09999999999')).toBe(true);
		expect(isValidCreditorId('DE98ABC09999999999')).toBe(true);
		expect(isValidCreditorId('DE97ZZZ09999999999')).toBe(false);
		expect(isValidCreditorId('DE98ZZZ')).toBe(false);
	});
});

describe('validateRecurring', () => {
	it('returns clean values', () => {
		expect(validateRecurring(valid, ctx)).toEqual({
			errors: null,
			values: {
				accountId: 'acc',
				kind: 'expense',
				name: 'Strom',
				counterparty: 'Stadtwerke Musterstadt',
				iban: 'DE89370400440532013000',
				mandateReference: 'MANDAT-123',
				creditorId: 'DE98ZZZ09999999999',
				categoryId: 'cat',
				interval: 'monthly',
				customEvery: null,
				customUnit: null,
				startDate: '2026-01-15',
				endDate: null,
				variable: true,
				// Salary flag only for income.
				isSalary: false,
				paymentMethod: 'direct_debit'
			}
		});
	});

	it('keeps the salary flag for income and drops the payment method', () => {
		const { values } = validateRecurring({ ...valid, kind: 'income' }, ctx);
		expect(values?.isSalary).toBe(true);
		expect(values?.paymentMethod).toBeNull();
	});

	it('validates custom intervals', () => {
		const custom = { ...valid, interval: 'custom', customEvery: '4', customUnit: 'week' };
		expect(validateRecurring(custom, ctx).values).toMatchObject({
			customEvery: 4,
			customUnit: 'week'
		});
		expect(
			validateRecurring({ ...custom, customEvery: '0' }, ctx).errors?.customEvery
		).toBeDefined();
		expect(
			validateRecurring({ ...custom, customEvery: '1,5' }, ctx).errors?.customEvery
		).toBeDefined();
		expect(
			validateRecurring({ ...custom, customUnit: 'year' }, ctx).errors?.customUnit
		).toBeDefined();
	});

	it('checks dates; one-off items have no end', () => {
		expect(validateRecurring({ ...valid, endDate: '2025-12-31' }, ctx).errors?.endDate).toBe(
			'Das Ende liegt vor dem Start.'
		);
		expect(
			validateRecurring({ ...valid, startDate: '2026-02-30' }, ctx).errors?.startDate
		).toBeDefined();
		expect(
			validateRecurring({ ...valid, interval: 'once', endDate: '2027-01-01' }, ctx).values?.endDate
		).toBeNull();
	});

	it('rejects unknown accounts, categories and bad identifiers', () => {
		const { errors } = validateRecurring(
			{
				...valid,
				accountId: 'other',
				categoryId: 'gone',
				iban: 'DE00 1234',
				creditorId: 'DE97ZZZ09999999999',
				name: '',
				kind: 'transfer'
			},
			ctx
		);
		expect(Object.keys(errors ?? {}).sort()).toEqual(
			['accountId', 'categoryId', 'creditorId', 'iban', 'kind', 'name'].sort()
		);
	});
});

describe('validateAmount', () => {
	it('accepts positive German amounts', () => {
		expect(validateAmount({ amount: '1.049,90', validFrom: '2027-01-01' }).values).toEqual({
			amount: 104990,
			validFrom: '2027-01-01'
		});
		expect(validateAmount({ amount: '0', validFrom: '2027-01-01' }).errors?.amount).toBeDefined();
		expect(validateAmount({ amount: '-5', validFrom: '2027-01-01' }).errors?.amount).toBeDefined();
		expect(validateAmount({ amount: '5', validFrom: '' }).errors?.validFrom).toBeDefined();
	});
});
