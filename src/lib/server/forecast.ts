import { and, eq, gt } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookings } from './db/schema.js';
import type { Viewer } from './account-rules.js';
import type { AccountWithLevel } from './accounts.js';
import { listRecurringFor, type RecurringSummary } from './recurring.js';
import { goalEvents } from './goals.js';
import { openPayments } from '../due.js';
import { forecast, type Forecast } from '../forecast.js';
import type { PlanEvent } from '../minimum.js';
import { addDays, addMonths } from '../recurring.js';
import { todayBerlin } from '../dates.js';

/**
 * 12-month forecast of an account: today's balance plus open due items (also transfers in and
 * out and savings-goal transfers) and bookings dated after today.
 */
export async function forecastFor(
	viewer: Viewer,
	account: AccountWithLevel,
	balance: number,
	today = todayBerlin(),
	/** "Was wäre wenn": changes the recurring items before the forecast. */
	transform?: (items: RecurringSummary[]) => RecurringSummary[]
): Promise<Forecast & { until: string }> {
	const until = addMonths(today, 12);
	const loaded = (await listRecurringFor(viewer)).filter((i) => !i.archivedAt);
	const items = transform ? transform(loaded) : loaded;
	const later = await db
		.select({ date: bookings.bookingDate, amount: bookings.amount, purpose: bookings.purpose })
		.from(bookings)
		.where(and(eq(bookings.accountId, account.id), gt(bookings.bookingDate, today)));
	const goals =
		account.type === 'giro' ? ((await goalEvents([account.id], today)).get(account.id) ?? []) : [];
	const events: PlanEvent[] = [
		...openPayments(items, new Set([account.id]), addDays(today, 1), until).map((p) => ({
			date: p.bookingDate,
			amount: p.amount,
			label: p.name
		})),
		...later.map((b) => ({ date: b.date, amount: b.amount, label: b.purpose ?? 'Buchung' })),
		...goals
	];
	return { ...forecast(balance, events, today, until), until };
}
