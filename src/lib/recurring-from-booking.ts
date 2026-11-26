// "Dauerposten daraus machen": a booking becomes the first payment of a new recurring item.
import { formatEuroInput } from './money.js';
import { addDays } from './recurring.js';

/** Bookings that can become a recurring item: real payments not belonging to one yet. */
export function canBecomeRecurring(b: {
	source: string;
	recurringId?: string | null;
	counterBookingId?: string | null;
	amount: number;
}): boolean {
	return (
		(b.source === 'manual' || b.source === 'import') &&
		!b.recurringId &&
		!b.counterBookingId &&
		b.amount !== 0
	);
}

type BookingLike = {
	accountId: string;
	bookingDate: string;
	amount: number;
	counterparty: string | null;
	purpose: string | null;
	iban: string | null;
	mandateReference: string | null;
	creditorId: string | null;
	categoryId: string | null;
};

/** Form values of the new item, taken from the booking (monthly as the usual case). */
export function recurringPrefill(b: BookingLike) {
	const name = (b.counterparty ?? b.purpose ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
	return {
		accountId: b.accountId,
		kind: b.amount < 0 ? 'expense' : 'income',
		targetAccountId: null,
		name,
		amount: formatEuroInput(Math.abs(b.amount)),
		counterparty: b.counterparty?.trim().slice(0, 70) || null,
		iban: b.iban,
		mandateReference: b.mandateReference,
		creditorId: b.creditorId,
		categoryId: b.categoryId,
		interval: 'monthly',
		customEvery: null,
		customUnit: null,
		// The booking is the first payment.
		startDate: b.bookingDate,
		endDate: null,
		variable: false,
		isSalary: false,
		paymentMethod: b.mandateReference ? 'direct_debit' : null,
		customerNumber: null,
		note: null
	};
}

/** Days the first due date may lie from the booking for the booking to count as its payment. */
export const FIRST_PAYMENT_WINDOW = 10;

/**
 * Whether the booking is the payment of the item's first due date (then no provisional
 * booking is created for it).
 */
export function isFirstPayment(bookingDate: string, startDate: string): boolean {
	return (
		startDate >= addDays(bookingDate, -FIRST_PAYMENT_WINDOW) &&
		startDate <= addDays(bookingDate, FIRST_PAYMENT_WINDOW)
	);
}
