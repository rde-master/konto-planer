import { formString } from './validation.js';
import type { BookingInput } from './booking-rules.js';

/** Reads the booking form; the quick entry has no date field and books on `today`. */
export function readBookingForm(data: FormData, today: string): BookingInput {
	return {
		kind: formString(data, 'kind'),
		amount: formString(data, 'amount'),
		accountId: formString(data, 'accountId'),
		categoryId: formString(data, 'categoryId'),
		bookingDate: data.has('bookingDate') ? formString(data, 'bookingDate') : today,
		counterparty: formString(data, 'counterparty'),
		purpose: formString(data, 'purpose')
	};
}
