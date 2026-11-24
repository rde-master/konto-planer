// Account balance: opening balance plus all bookings from the opening date on (see CLAUDE.md).

export type Opening = { openingBalance: number; openingDate: string };
export type BalanceBooking = { bookingDate: string; amount: number };

/** Whether a booking counts towards the balance (older bookings are kept but do not count). */
export function countsToBalance(openingDate: string, bookingDate: string): boolean {
	return bookingDate >= openingDate;
}

/** Balance at the end of `date` (all counting bookings up to and including that day). */
export function balanceOn(account: Opening, bookings: BalanceBooking[], date: string): number {
	let sum = account.openingBalance;
	for (const b of bookings)
		if (countsToBalance(account.openingDate, b.bookingDate) && b.bookingDate <= date)
			sum += b.amount;
	return sum;
}

/** Amount of the adjustment booking that brings `current` to `actual` (0 = nothing to do). */
export function adjustmentAmount(current: number, actual: number): number {
	return actual - current;
}
