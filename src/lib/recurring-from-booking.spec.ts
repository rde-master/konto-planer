import { describe, expect, it } from 'vitest';
import { canBecomeRecurring, isFirstPayment, recurringPrefill } from './recurring-from-booking';

const booking = {
	accountId: 'a1',
	bookingDate: '2026-11-20',
	amount: -1299,
	counterparty: '  Zeitschrift   Beispiel Verlag ',
	purpose: 'Abo 4711',
	iban: 'DE02120300000000202051',
	mandateReference: 'MREF-1',
	creditorId: 'DE98ZZZ09999999999',
	categoryId: 'c1'
};

describe('canBecomeRecurring', () => {
	const base = { source: 'manual', recurringId: null, counterBookingId: null, amount: -100 };
	it('takes manual and imported payments without an item', () => {
		expect(canBecomeRecurring(base)).toBe(true);
		expect(canBecomeRecurring({ ...base, source: 'import' })).toBe(true);
	});
	it('not provisional, computed or internal bookings', () => {
		expect(canBecomeRecurring({ ...base, source: 'provisional' })).toBe(false);
		expect(canBecomeRecurring({ ...base, source: 'adjustment' })).toBe(false);
		expect(canBecomeRecurring({ ...base, recurringId: 'r1' })).toBe(false);
		expect(canBecomeRecurring({ ...base, counterBookingId: 'b2' })).toBe(false);
	});
});

describe('recurringPrefill', () => {
	it('takes name, amount, payee and direct debit data from the booking', () => {
		expect(recurringPrefill(booking)).toMatchObject({
			accountId: 'a1',
			kind: 'expense',
			name: 'Zeitschrift Beispiel Verlag',
			amount: '12,99',
			counterparty: 'Zeitschrift   Beispiel Verlag',
			iban: 'DE02120300000000202051',
			mandateReference: 'MREF-1',
			categoryId: 'c1',
			interval: 'monthly',
			startDate: '2026-11-20',
			paymentMethod: 'direct_debit'
		});
	});
	it('income and a booking without payee', () => {
		const p = recurringPrefill({
			...booking,
			amount: 250000,
			counterparty: null,
			mandateReference: null
		});
		expect(p).toMatchObject({
			kind: 'income',
			name: 'Abo 4711',
			amount: '2.500,00',
			paymentMethod: null
		});
	});
});

describe('isFirstPayment', () => {
	it('within ten days of the booking', () => {
		expect(isFirstPayment('2026-11-20', '2026-11-20')).toBe(true);
		expect(isFirstPayment('2026-11-20', '2026-11-15')).toBe(true);
		expect(isFirstPayment('2026-11-20', '2026-11-30')).toBe(true);
		expect(isFirstPayment('2026-11-20', '2026-12-20')).toBe(false);
		expect(isFirstPayment('2026-11-20', '2026-10-20')).toBe(false);
	});
});
