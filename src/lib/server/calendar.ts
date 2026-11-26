import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { calendarFeeds, users } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import type { Viewer } from './account-rules.js';
import { generateSessionToken, hashSessionToken } from './session-token.js';
import { listAccountsFor } from './accounts.js';
import { listRecurringFor } from './recurring.js';
import { listGoalsFor } from './goals.js';
import { settlementEvents } from './credit-cards.js';
import { getSettings } from './settings.js';
import { openPayments } from '../due.js';
import { contractStatus, terminationEnd } from '../contracts.js';
import { CALENDAR_KINDS, type CalendarEvent, type CalendarKind } from '../ical.js';
import { addMonths } from '../recurring.js';
import { formatEuro } from '../money.js';
import { formatDay, todayBerlin } from '../dates.js';

export function cleanKinds(values: string[]): CalendarKind[] {
	return CALENDAR_KINDS.filter((k) => values.includes(k));
}

export async function feedOf(userId: string) {
	const [row] = await db.select().from(calendarFeeds).where(eq(calendarFeeds.userId, userId));
	return row
		? {
				include: cleanKinds(row.include),
				createdAt: row.createdAt,
				lastFetchedAt: row.lastFetchedAt
			}
		: null;
}

/** New subscription link (an old one stops working); returns the token once. */
export async function createFeed(actor: NonNullable<Actor>, include: CalendarKind[]) {
	const token = generateSessionToken();
	const tokenHash = hashSessionToken(token);
	await db.transaction(async (tx) => {
		await tx
			.insert(calendarFeeds)
			.values({ userId: actor.id, tokenHash, include })
			.onConflictDoUpdate({
				target: calendarFeeds.userId,
				set: { tokenHash, include, createdAt: new Date(), lastFetchedAt: null }
			});
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'Kalender-Abo',
			after: { calendarFeed: 'neuer Link', calendarInclude: include.join(', ') }
		});
	});
	return token;
}

export async function setFeedKinds(actor: NonNullable<Actor>, include: CalendarKind[]) {
	await db.transaction(async (tx) => {
		const updated = await tx
			.update(calendarFeeds)
			.set({ include })
			.where(eq(calendarFeeds.userId, actor.id))
			.returning({ userId: calendarFeeds.userId });
		if (!updated.length) return;
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'Kalender-Abo',
			after: { calendarInclude: include.join(', ') || '–' }
		});
	});
}

export async function deleteFeed(actor: NonNullable<Actor>) {
	await db.transaction(async (tx) => {
		const gone = await tx
			.delete(calendarFeeds)
			.where(eq(calendarFeeds.userId, actor.id))
			.returning({ userId: calendarFeeds.userId });
		if (!gone.length) return;
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'Kalender-Abo',
			after: { calendarFeed: 'beendet' }
		});
	});
}

/** User and kinds of a subscription link (null = unknown token or inactive user). */
export async function feedByToken(token: string) {
	if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
	const [row] = await db
		.select({ feed: calendarFeeds, user: users })
		.from(calendarFeeds)
		.innerJoin(users, eq(users.id, calendarFeeds.userId))
		.where(eq(calendarFeeds.tokenHash, hashSessionToken(token)));
	if (!row || (row.user.role !== 'admin' && row.user.role !== 'user')) return null;
	await db
		.update(calendarFeeds)
		.set({ lastFetchedAt: new Date() })
		.where(eq(calendarFeeds.userId, row.user.id));
	return {
		viewer: { id: row.user.id, role: row.user.role },
		include: cleanKinds(row.feed.include)
	};
}

const signed = (cents: number) => `${cents > 0 ? '+' : ''}${formatEuro(cents)}`;

/** Events from 3 months back to 12 months ahead for the accounts the viewer sees. */
export async function calendarEvents(
	viewer: Viewer,
	include: CalendarKind[],
	today = todayBerlin()
): Promise<CalendarEvent[]> {
	const from = addMonths(today, -3);
	const to = addMonths(today, 12);
	const accounts = (await listAccountsFor(viewer)).filter((a) => !a.archivedAt);
	const ids = new Set(accounts.map((a) => a.id));
	const names = new Map(accounts.map((a) => [a.id, a.name]));
	const items = (await listRecurringFor(viewer)).filter((i) => !i.archivedAt);
	const out: CalendarEvent[] = [];

	if (include.includes('payments')) {
		const seen = new Set<string>();
		for (const p of openPayments(items, ids, from, to)) {
			const item = items.find((i) => i.id === p.recurringId)!;
			const key = `${p.recurringId}:${p.dueDate}`;
			if (seen.has(key)) continue;
			seen.add(key);
			const transfer = item.kind === 'transfer';
			const amount = transfer ? Math.abs(p.amount) : p.amount;
			out.push({
				uid: `pay-${key}`,
				date: p.bookingDate,
				title: `${p.name} ${transfer ? formatEuro(amount) : signed(amount)}`,
				description: transfer
					? `Umbuchung ${item.account.name} → ${item.targetAccount?.name ?? ''}`
					: `Konto: ${names.get(p.accountId) ?? ''}`
			});
		}
	}

	if (include.includes('deadlines')) {
		const { defaultLeadDays } = await getSettings();
		for (const i of items) {
			if (!i.contract || !ids.has(i.accountId)) continue;
			const status = contractStatus(i.contract, today);
			if (status.state !== 'fixed') continue;
			out.push({
				uid: `deadline-${i.id}-${status.deadline}`,
				date: status.deadline,
				title: `Kündigen bis: ${i.name}`,
				description: `Sonst läuft der Vertrag über den ${formatDay(status.end)} hinaus (frühestes Ende bei Kündigung heute: ${formatDay(terminationEnd({ ...i.contract, cancelledOn: null }, today))}).`,
				alarmDays: i.contract.leadDays ?? defaultLeadDays
			});
		}
	}

	if (include.includes('cards')) {
		const giro = accounts.filter((a) => a.type === 'giro').map((a) => a.id);
		const events = await settlementEvents(giro, today, to);
		for (const id of giro)
			for (const e of events.get(id) ?? [])
				out.push({
					uid: `card-${id}-${e.date}-${e.label}`.replace(/[^A-Za-z0-9-]/g, ''),
					date: e.date,
					title: `${e.label} ${formatEuro(e.amount)}`,
					description: `Abbuchung von ${names.get(id) ?? ''} (berechnet)`
				});
	}

	if (include.includes('goals')) {
		for (const g of await listGoalsFor(viewer)) {
			if (g.done || !g.date || g.date < from || g.date > to) continue;
			out.push({
				uid: `goal-${g.id}-${g.date}`,
				date: g.date,
				title: `Sparziel: ${g.name} (${formatEuro(g.allocated)} von ${formatEuro(g.targetAmount)})`,
				description: `Sparbuch: ${g.account.name}`
			});
		}
	}
	return out.sort((a, b) => a.date.localeCompare(b.date));
}
