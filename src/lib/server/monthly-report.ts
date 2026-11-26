import { and, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookings, notificationLog, users } from './db/schema.js';
import type { Viewer } from './account-rules.js';
import { listAccountsFor } from './accounts.js';
import { balancesOf } from './bookings.js';
import { plansFor } from './minimum.js';
import { budgetsFor } from './budgets.js';
import { listRecurringFor } from './recurring.js';
import { getSettings } from './settings.js';
import { metricsFor, reportBookings, reportCategories } from './reports.js';
import { increasesOn } from './watch.js';
import { NotifyError, notifySettings, sendEmail } from './notify.js';
import { isDemo } from './demo-mode.js';
import { buildReport, reportMonth, SEND_UNTIL_DAY, type ReportData } from '../monthly-report.js';
import { expensesByCategory, inOutByMonth, monthRange } from '../reports.js';
import { cancelSoon, contractStatus } from '../contracts.js';
import { addMonths } from '../recurring.js';
import { berlinDay, todayBerlin } from '../dates.js';
import { SEND_HOUR, berlinHour } from '../notify.js';

/** The report of `month` for one user (the accounts they see). */
export async function reportDataFor(
	user: Viewer & { name: string },
	month: string,
	today = todayBerlin()
): Promise<ReportData> {
	const accounts = (await listAccountsFor(user)).filter((a) => !a.archivedAt);
	const paying = accounts.filter((a) => a.type !== 'sparbuch').map((a) => a.id);
	const { from, to } = monthRange(month);
	const prevMonth = addMonths(from, -1).slice(0, 7);
	const prev = monthRange(prevMonth);
	const [now, before, cats, budgets, metrics, increases, items, settings] = await Promise.all([
		reportBookings(paying, from, to),
		reportBookings(paying, prev.from, prev.to),
		reportCategories(),
		budgetsFor(user, month),
		metricsFor(user, today),
		increasesOn(
			accounts.map((a) => a.id),
			today
		),
		listRecurringFor(user),
		getSettings()
	]);
	const inOut = inOutByMonth(now, [month])[0];
	const previous = new Map(expensesByCategory(before, cats).map((c) => [c.id, c.amount]));
	const categories = expensesByCategory(now, cats)
		.slice(0, 6)
		.map((c) => ({ name: c.name, amount: c.amount, previous: previous.get(c.id) ?? 0 }));
	const largest = now
		.filter((b) => !b.internal && b.amount < 0)
		.sort((a, b) => a.amount - b.amount)
		.slice(0, 5)
		.map((b) => ({ label: b.label, date: b.bookingDate, amount: -b.amount }));

	// Balance at the end of the month: today's minus everything booked after it.
	const balances = await balancesOf(accounts);
	const after = accounts.length
		? await db
				.select({ accountId: bookings.accountId, sum: sql<string>`sum(${bookings.amount})` })
				.from(bookings)
				.where(
					and(
						inArray(
							bookings.accountId,
							accounts.map((a) => a.id)
						),
						gt(bookings.bookingDate, to),
						lte(bookings.bookingDate, today)
					)
				)
				.groupBy(bookings.accountId)
		: [];
	const afterOf = new Map(after.map((r) => [r.accountId, Number(r.sum)]));
	const plans = await plansFor(user, accounts, balances);
	const m = metrics.months.find((x) => x.month === month);
	const deadlines = items
		.filter(
			(i) => !i.archivedAt && i.contract && cancelSoon(i.contract, today, settings.defaultLeadDays)
		)
		.map((i) => ({ name: i.name, status: contractStatus(i.contract!, today) }))
		.filter((x) => x.status.state === 'fixed')
		.map((x) => ({ name: x.name, deadline: (x.status as { deadline: string }).deadline }))
		.sort((a, b) => a.deadline.localeCompare(b.deadline));
	const origin = process.env.ORIGIN?.trim();
	return {
		userName: user.name.split(' ')[0],
		month,
		income: inOut?.income ?? 0,
		expenses: inOut?.expenses ?? 0,
		largest,
		categories,
		budgets: budgets.map((b) => ({
			name: `${b.categoryName} · ${b.accountName}`,
			limit: b.limit,
			spent: b.spent
		})),
		accounts: accounts.map((a) => ({
			name: a.name,
			endBalance: (balances.get(a.id) ?? a.openingBalance) - (afterOf.get(a.id) ?? 0),
			available: plans.get(a.id)?.plan.available ?? null
		})),
		saved: m?.saved ?? 0,
		savingsRate: m?.rate ?? null,
		increases: increases
			.filter((x) => x.source === 'amount')
			.slice(0, 5)
			.map((x) => ({ name: x.name, before: x.before, after: x.after, percent: x.percent })),
		deadlines,
		appUrl: origin?.startsWith('http') ? origin : null
	};
}

type Recipient = { id: string; role: 'admin' | 'user'; name: string; email: string | null };

async function send(user: Recipient, month: string, today: string) {
	const { smtp } = await notifySettings();
	if (!smtp) throw new NotifyError('Der E-Mail-Versand ist noch nicht eingerichtet.');
	if (!user.email)
		throw new NotifyError('Für deinen Benutzer ist keine E-Mail-Adresse eingetragen.');
	const report = buildReport(await reportDataFor(user, month, today));
	let error: string | null = null;
	try {
		await sendEmail(smtp, user.email, report.subject, report.text, report.html);
	} catch (e) {
		error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
	}
	await db.insert(notificationLog).values({
		type: 'monthly_report',
		key: month,
		userId: user.id,
		channel: 'email',
		title: report.subject.replace('Konto Planer: ', ''),
		ok: error === null,
		error
	});
	if (error) throw new NotifyError(`E-Mail konnte nicht gesendet werden: ${error}`);
}

/** "Jetzt senden": the previous month's report to the user, right away. */
export async function sendReportNow(user: Recipient, today = todayBerlin()) {
	await send(user, reportMonth(today), today);
}

/** Hourly job: in the first days of a month from 8 o'clock, once per user and month. */
export async function runMonthlyReports(now = new Date()): Promise<number> {
	const today = berlinDay(now);
	if (isDemo() || Number(today.slice(8)) > SEND_UNTIL_DAY || berlinHour(now) < SEND_HOUR) return 0;
	const { smtp } = await notifySettings();
	if (!smtp) return 0;
	const month = reportMonth(today);
	const people = await db
		.select({ id: users.id, role: users.role, name: users.name, email: users.email })
		.from(users)
		.where(eq(users.monthlyReport, true));
	let sent = 0;
	for (const p of people) {
		if (!p.email || (p.role !== 'admin' && p.role !== 'user')) continue;
		const [done] = await db
			.select({ id: notificationLog.id })
			.from(notificationLog)
			.where(
				and(
					eq(notificationLog.type, 'monthly_report'),
					eq(notificationLog.key, month),
					eq(notificationLog.userId, p.id),
					eq(notificationLog.ok, true)
				)
			)
			.orderBy(desc(notificationLog.sentAt))
			.limit(1);
		if (done) continue;
		try {
			await send(p, month, today);
			sent++;
		} catch (e) {
			console.error('Monatsbericht: Versand fehlgeschlagen', e);
		}
	}
	return sent;
}
