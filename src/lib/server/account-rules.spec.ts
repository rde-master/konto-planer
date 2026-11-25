import { describe, expect, it } from 'vitest';
import {
	canEditAccount,
	effectiveLevel,
	validateAccount,
	type AccountInput
} from './account-rules';

const valid: AccountInput = {
	name: ' Gemeinschaftskonto ',
	type: 'giro',
	color: 'green',
	iban: 'de89 3704 0044 0532 0130 00',
	openingBalance: '1.234,56',
	openingDate: '2026-11-01',
	overdraftLimit: '1.000',
	buffer: '',
	settlementAccountId: '',
	statementDay: '',
	debitDay: ''
};

describe('validateAccount', () => {
	it('returns clean values', () => {
		expect(validateAccount(valid)).toEqual({
			errors: null,
			values: {
				name: 'Gemeinschaftskonto',
				type: 'giro',
				color: 'green',
				iban: 'DE89370400440532013000',
				openingBalance: 123456,
				openingDate: '2026-11-01',
				overdraftLimit: 100000,
				buffer: 0,
				settlementAccountId: null,
				statementDay: null,
				debitDay: null
			}
		});
	});

	it('allows an empty IBAN and a negative opening balance', () => {
		const r = validateAccount({ ...valid, iban: '', openingBalance: '-250,00' });
		expect(r.values?.iban).toBeNull();
		expect(r.values?.openingBalance).toBe(-25000);
	});

	it('ignores the overdraft for savings accounts', () => {
		expect(
			validateAccount({ ...valid, type: 'sparbuch', overdraftLimit: '500' }).values?.overdraftLimit
		).toBe(0);
	});

	it('reports every invalid field', () => {
		const r = validateAccount({
			name: '',
			type: 'depot',
			color: 'neon',
			iban: 'DE00 1234',
			openingBalance: 'viel',
			openingDate: '2026-02-30',
			overdraftLimit: '-5',
			buffer: '',
			settlementAccountId: '',
			statementDay: '',
			debitDay: ''
		});
		expect(Object.keys(r.errors ?? {}).sort()).toEqual(
			['color', 'iban', 'name', 'openingBalance', 'openingDate', 'type'].sort()
		);
	});

	it('takes a buffer on giro accounts only', () => {
		expect(validateAccount({ ...valid, buffer: '250' }).values?.buffer).toBe(25000);
		expect(validateAccount({ ...valid, buffer: '-1' }).errors?.buffer).toBeDefined();
		expect(validateAccount({ ...valid, type: 'sparbuch', buffer: '250' }).values?.buffer).toBe(0);
	});

	it('rejects a negative overdraft on giro accounts', () => {
		expect(
			validateAccount({ ...valid, overdraftLimit: '-5' }).errors?.overdraftLimit
		).toBeDefined();
	});
});

describe('access', () => {
	it('gives admins edit rights everywhere', () => {
		expect(effectiveLevel({ id: 'a', role: 'admin' }, null)).toBe('edit');
	});

	it('uses the granted level for users', () => {
		expect(effectiveLevel({ id: 'u', role: 'user' }, 'view')).toBe('view');
		expect(effectiveLevel({ id: 'u', role: 'user' }, null)).toBeNull();
	});

	it('blocks edits on archived accounts and for viewers', () => {
		expect(canEditAccount('edit', false)).toBe(true);
		expect(canEditAccount('edit', true)).toBe(false);
		expect(canEditAccount('view', false)).toBe(false);
	});
});

describe('credit cards', () => {
	const card = {
		...valid,
		type: 'kreditkarte',
		iban: '',
		settlementAccountId: '7b0e6f3c-1d2a-4c5b-8e9f-0a1b2c3d4e5f',
		statementDay: '20',
		debitDay: '28',
		buffer: '50'
	};
	it('keeps limit and settlement, no buffer', () => {
		expect(validateAccount(card).values).toMatchObject({
			type: 'kreditkarte',
			overdraftLimit: 100_000,
			buffer: 0,
			statementDay: 20,
			debitDay: 28,
			settlementAccountId: card.settlementAccountId
		});
	});
	it('needs the giro account and valid days', () => {
		const r = validateAccount({
			...card,
			settlementAccountId: '',
			statementDay: '0',
			debitDay: '32'
		});
		expect(Object.keys(r.errors ?? {}).sort()).toEqual([
			'debitDay',
			'settlementAccountId',
			'statementDay'
		]);
	});
	it('other types drop the card fields', () => {
		expect(validateAccount({ ...valid, statementDay: '20' }).values?.statementDay).toBeNull();
	});
});
