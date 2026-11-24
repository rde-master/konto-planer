import { describe, expect, it } from 'vitest';
import {
	canDeleteTemplate,
	canEditTemplate,
	canUnshareTemplate,
	moveInOrder,
	validateTemplate,
	type TemplateInput
} from './template-rules';

const ctx = { accountIds: new Set(['giro']), categoryIds: new Set(['food']) };

const input = (over: Partial<TemplateInput> = {}): TemplateInput => ({
	name: 'Bäcker',
	kind: 'expense',
	amount: '',
	accountId: '',
	categoryId: '',
	counterparty: '',
	shared: '',
	...over
});

const admin = { id: 'a', role: 'admin' as const };
const lena = { id: 'l', role: 'user' as const };

describe('validateTemplate', () => {
	it('amount and account are optional', () => {
		expect(validateTemplate(input({ name: '  Tanken ' }), ctx).values).toEqual({
			name: 'Tanken',
			kind: 'expense',
			amount: null,
			accountId: null,
			categoryId: null,
			counterparty: null,
			shared: false
		});
	});
	it('stores the amount positive in cents', () => {
		const { values } = validateTemplate(
			input({
				kind: 'income',
				amount: '1.234,50',
				accountId: 'giro',
				categoryId: 'food',
				counterparty: ' Bäckerei  Muster ',
				shared: 'on'
			}),
			ctx
		);
		expect(values).toMatchObject({
			kind: 'income',
			amount: 123450,
			accountId: 'giro',
			categoryId: 'food',
			counterparty: 'Bäckerei Muster',
			shared: true
		});
	});
	it('rejects missing name, bad amount, foreign account and unknown category', () => {
		const { errors } = validateTemplate(
			input({ name: ' ', kind: 'x', amount: '0', accountId: 'other', categoryId: 'gone' }),
			ctx
		);
		expect(Object.keys(errors ?? {}).sort()).toEqual([
			'accountId',
			'amount',
			'categoryId',
			'kind',
			'name'
		]);
		expect(validateTemplate(input({ name: 'x'.repeat(31) }), ctx).errors?.name).toBe(
			'Höchstens 30 Zeichen.'
		);
	});
	it('keeps the current account even if the editor cannot book on it', () => {
		const { values } = validateTemplate(input({ accountId: 'other' }), {
			...ctx,
			currentAccountId: 'other'
		});
		expect(values?.accountId).toBe('other');
	});
});

describe('template rights', () => {
	it('own templates: only the owner', () => {
		expect(canEditTemplate(lena, { ownerId: 'l' })).toBe(true);
		expect(canEditTemplate(admin, { ownerId: 'l' })).toBe(false);
		expect(canDeleteTemplate(lena, { ownerId: 'l' })).toBe(true);
		expect(canDeleteTemplate(admin, { ownerId: 'l' })).toBe(false);
	});
	it('shared templates: everyone edits, only the admin deletes or unshares', () => {
		expect(canEditTemplate(lena, { ownerId: null })).toBe(true);
		expect(canDeleteTemplate(lena, { ownerId: null })).toBe(false);
		expect(canDeleteTemplate(admin, { ownerId: null })).toBe(true);
		expect(canUnshareTemplate(lena)).toBe(false);
		expect(canUnshareTemplate(admin)).toBe(true);
	});
});

describe('moveInOrder', () => {
	it('swaps with the neighbour', () => {
		expect(moveInOrder(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c']);
		expect(moveInOrder(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b']);
	});
	it('does nothing at the ends or for unknown ids', () => {
		expect(moveInOrder(['a', 'b'], 'a', 'up')).toBeNull();
		expect(moveInOrder(['a', 'b'], 'b', 'down')).toBeNull();
		expect(moveInOrder(['a'], 'x', 'up')).toBeNull();
	});
});
