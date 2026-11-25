// Reminders for manual transfers ("Erinnerung an manuelle Überweisungen"): outgoing recurring
// items paid by hand are reminded a number of bank days before their bank day, until marked
// as transferred, confirmed by an import or skipped.
import { isBankDay } from './bank-calendar.js';
import { duesBetween, type DueStatus, type PlannedItem } from './due.js';
import { addDays } from './recurring.js';

/** Reminders look back this many days for transfers still open. */
export const LOOKBACK_DAYS = 30;

/** `n` bank days before `day` (0 = the day itself). */
export function bankDaysBefore(day: string, n: number): string {
	let d = day;
	for (let i = 0; i < n;) {
		d = addDays(d, -1);
		if (isBankDay(d)) i++;
	}
	return d;
}

export type ManualItem = PlannedItem & { paymentMethod: string | null };

export type StoredDue = {
	recurringId: string;
	dueDate: string;
	bookingDate: string;
	amount: number;
	status: DueStatus;
};

export type ManualReminder = {
	recurringId: string;
	name: string;
	accountId: string;
	targetAccountId: string | null;
	dueDate: string;
	bookingDate: string;
	/** Positive cents. */
	amount: number;
	/** The bank day has passed. */
	overdue: boolean;
};

export function isManualTransfer(item: Pick<ManualItem, 'paymentMethod' | 'kind'>): boolean {
	return item.paymentMethod === 'manual' && item.kind !== 'income';
}

/** Open manual transfers whose reminder day (bank day minus `lead` bank days) has come. */
export function manualReminders(
	items: ManualItem[],
	stored: StoredDue[],
	done: Set<string>,
	today: string,
	lead: number
): ManualReminder[] {
	const byKey = new Map(stored.map((s) => [`${s.recurringId}:${s.dueDate}`, s]));
	// Far enough ahead for the longest lead (weekends and holidays included).
	const until = addDays(today, lead * 2 + 7);
	const out: ManualReminder[] = [];
	for (const item of items) {
		if (!isManualTransfer(item)) continue;
		for (const due of duesBetween(item, item.amounts, addDays(today, -LOOKBACK_DAYS), until)) {
			const key = `${item.id}:${due.dueDate}`;
			if (done.has(key)) continue;
			const s = byKey.get(key);
			if (s && s.status !== 'provisional') continue;
			const bookingDate = s?.bookingDate ?? due.bookingDate;
			if (bankDaysBefore(bookingDate, lead) > today) continue;
			out.push({
				recurringId: item.id,
				name: item.name,
				accountId: item.accountId,
				targetAccountId: item.targetAccountId,
				dueDate: due.dueDate,
				bookingDate,
				amount: s?.amount ?? due.amount,
				overdue: bookingDate < today
			});
		}
	}
	return out.sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
}
