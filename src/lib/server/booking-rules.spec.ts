import { describe, expect, it } from 'vitest';
import { validateBooking, type BookingInput } from './booking-rules';

const ctx = {
	accountIds: new Set(['giro']),
	categoryIds: new Set(['food']),
	today: '2026-11-24'
};

const input = (over: Partial<BookingInput>): BookingInput => ({
	kind: 'expense',
	amount: '12,50',
	accountId: 'giro',
	categoryId: '',
	bookingDate: '2026-11-24',
	counterparty: '',
	purpose: '',
	...over
});

describe('validateBooking', () => {
	it('expenses are stored negative, income positive', () => {
		expect(validateBooking(input({}), ctx).values).toEqual({
			accountId: 'giro',
			bookingDate: '2026-11-24',
			amount: -1250,
			categoryId: null,
			counterparty: null,
			purpose: null
		});
		expect(validateBooking(input({ kind: 'income', amount: '1.000' }), ctx).values?.amount).toBe(
			100000
		);
	});
	it('keeps optional texts trimmed', () => {
		const { values } = validateBooking(
			input({ counterparty: '  Bäckerei   Muster ', purpose: 'Brötchen', categoryId: 'food' }),
			ctx
		);
		expect(values).toMatchObject({
			counterparty: 'Bäckerei Muster',
			purpose: 'Brötchen',
			categoryId: 'food'
		});
	});
	it('rejects missing or invalid fields', () => {
		const { errors } = validateBooking(
			input({ kind: 'x', amount: '0', accountId: 'other', categoryId: 'gone', bookingDate: '' }),
			ctx
		);
		expect(Object.keys(errors ?? {}).sort()).toEqual([
			'accountId',
			'amount',
			'bookingDate',
			'categoryId',
			'kind'
		]);
	});
	it('no bookings in the future', () => {
		expect(validateBooking(input({ bookingDate: '2026-11-25' }), ctx).errors?.bookingDate).toBe(
			'Das Datum darf nicht in der Zukunft liegen.'
		);
	});
});
