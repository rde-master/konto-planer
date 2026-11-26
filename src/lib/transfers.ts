// A booking becomes a transfer between two accounts of the app: money leaves one account and
// arrives on the other. Both bookings are linked and count as internal in the reports.

/** A booking on the other account may be the other side if it lies within this many days. */
export const TRANSFER_WINDOW = 3;

/** Real payments (entered or imported) that are no transfer yet and belong to no item. */
export function canLinkTransfer(b: {
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

function days(a: string, b: string): number {
	return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/**
 * The booking on the other account that is the other side already: the opposite amount within
 * ±3 days, the nearest day first. Undefined = a counter booking has to be created.
 */
export function pickCounter<T extends { date: string; amount: number }>(
	booking: { date: string; amount: number },
	candidates: T[]
): T | undefined {
	return candidates
		.filter((c) => c.amount === -booking.amount && days(c.date, booking.date) <= TRANSFER_WINDOW)
		.sort((a, b) => days(a.date, booking.date) - days(b.date, booking.date))[0];
}

/** "Auf Sparbuch" for the paying side, "Von Girokonto" for the receiving one. */
export function transferLabel(amount: number, otherAccount: string): string {
	return `${amount < 0 ? 'Auf' : 'Von'} ${otherAccount}`;
}
