import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import {
	accountAccess,
	accountInterestRates,
	accounts,
	bookings,
	budgets,
	categories,
	recurringAmounts,
	savingsGoals,
	users
} from './db/schema.js';
import { hashPassword } from './auth.js';
import { createDefaultCategories } from './categories.js';
import { createRecurring } from './recurring.js';
import type { RecurringValues } from './recurring-rules.js';
import type { Contract } from '../contracts.js';
import { syncDues } from './due.js';
import { demoBookings } from '../demo.js';
import { addDays, addMonths } from '../recurring.js';
import { todayBerlin } from '../dates.js';

import { isDemo } from './demo-mode.js';

export { isDemo };
export const DEMO_USERNAME = 'demo';

/** The demo user's id (for the automatic login). */
export async function demoUserId(): Promise<string | null> {
	const [u] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.username, DEMO_USERNAME));
	return u?.id ?? null;
}

/** Day of month as date in the month `offset` months from today. */
function dayOf(today: string, offset: number, day: number): string {
	const first = addMonths(`${today.slice(0, 7)}-01`, offset);
	return `${first.slice(0, 8)}${String(day).padStart(2, '0')}`;
}

/** Fills an empty database with the household "Beispiel" (amounts in cents). */
export async function seedDemo(today = todayBerlin()) {
	const opening = dayOf(today, -6, 1);
	const password = await hashPassword(randomBytes(24).toString('base64url'));
	const [alex] = await db
		.insert(users)
		.values({
			username: DEMO_USERNAME,
			name: 'Alex Beispiel',
			passwordHash: password,
			role: 'admin',
			lastSeenVersion: __APP_VERSION__
		})
		.returning();
	const [kim] = await db
		.insert(users)
		.values({
			username: 'kim',
			name: 'Kim Beispiel',
			passwordHash: password,
			role: 'user',
			lastSeenVersion: __APP_VERSION__
		})
		.returning();
	const actor = { id: alex.id, name: alex.name, role: 'admin' as const };
	await createDefaultCategories(actor);
	const cats = await db.select({ id: categories.id, name: categories.name }).from(categories);
	const cat = (name: string) => cats.find((c) => c.name === name)?.id ?? null;

	const [giro, haushalt, tagesgeld] = await db
		.insert(accounts)
		.values([
			{
				name: 'Gemeinschaftskonto',
				type: 'giro',
				color: 'blue',
				iban: 'DE89370400440532013000',
				openingBalance: 145_000,
				openingDate: opening,
				overdraftLimit: 100_000,
				buffer: 20_000
			},
			{
				name: 'Haushaltskonto',
				type: 'giro',
				color: 'green',
				openingBalance: 61_000,
				openingDate: opening,
				buffer: 5_000
			},
			{
				name: 'Tagesgeld',
				type: 'sparbuch',
				color: 'orange',
				openingBalance: 850_000,
				openingDate: opening,
				interestRhythm: 'monthly'
			}
		])
		.returning();
	const [card] = await db
		.insert(accounts)
		.values({
			name: 'Kreditkarte',
			type: 'kreditkarte',
			color: 'purple',
			openingBalance: 0,
			openingDate: opening,
			overdraftLimit: 200_000,
			settlementAccountId: haushalt.id,
			statementDay: 20,
			debitDay: 28
		})
		.returning();
	await db.insert(accountAccess).values([
		{ accountId: giro.id, userId: kim.id, level: 'edit' },
		{ accountId: haushalt.id, userId: kim.id, level: 'edit' },
		{ accountId: tagesgeld.id, userId: kim.id, level: 'view' }
	]);
	await db
		.insert(accountInterestRates)
		.values({ accountId: tagesgeld.id, rate: 2250, validFrom: opening });

	const item = (
		v: Partial<RecurringValues> & Pick<RecurringValues, 'accountId' | 'name' | 'startDate'>
	): RecurringValues => ({
		kind: 'expense',
		targetAccountId: null,
		counterparty: v.name,
		iban: null,
		mandateReference: null,
		creditorId: null,
		categoryId: null,
		interval: 'monthly',
		customEvery: null,
		customUnit: null,
		endDate: null,
		variable: false,
		isSalary: false,
		paymentMethod: 'direct_debit',
		customerNumber: null,
		note: null,
		...v
	});
	const contract = (termEnd: string, notice: number): Contract => ({
		termEnd,
		noticeEvery: notice,
		noticeUnit: 'month',
		renewal: 'period',
		renewalMonths: 12,
		leadDays: null,
		cancelledOn: null,
		cancelName: null,
		cancelStreet: null,
		cancelPostalCode: null,
		cancelCity: null,
		cancelEmail: null
	});
	const add = (v: RecurringValues, amount: number, c: Contract | null = null) =>
		createRecurring(actor, v, amount, c);

	await add(
		item({
			accountId: giro.id,
			kind: 'income',
			name: 'Gehalt',
			counterparty: 'Beispiel Werkstätten GmbH',
			categoryId: cat('Gehalt'),
			startDate: dayOf(today, -6, 27),
			isSalary: true,
			paymentMethod: null
		}),
		348_000
	);
	await add(
		item({
			accountId: giro.id,
			kind: 'income',
			name: 'Kindergeld',
			counterparty: 'Familienkasse',
			categoryId: cat('Kindergeld'),
			startDate: dayOf(today, -6, 5),
			paymentMethod: null
		}),
		25_500
	);
	await add(
		item({
			accountId: giro.id,
			name: 'Miete',
			counterparty: 'Hausverwaltung Muster',
			categoryId: cat('Miete'),
			startDate: dayOf(today, -6, 1),
			paymentMethod: 'standing_order'
		}),
		115_000
	);
	const strom = await add(
		item({
			accountId: giro.id,
			name: 'Strom',
			counterparty: 'Stadtwerke Beispielstadt',
			categoryId: cat('Strom'),
			startDate: dayOf(today, -6, 15)
		}),
		8_200
	);
	await db
		.insert(recurringAmounts)
		.values({ recurringId: strom, amount: 8_900, validFrom: dayOf(today, -1, 15) });
	await add(
		item({
			accountId: giro.id,
			name: 'Internet',
			counterparty: 'Netz Beispiel',
			categoryId: cat('Internet und Telefon'),
			startDate: dayOf(today, -6, 3)
		}),
		3_999,
		contract(dayOf(today, 8, 2), 3)
	);
	await add(
		item({
			accountId: haushalt.id,
			name: 'Fitnessstudio',
			counterparty: 'Fitness Muster',
			categoryId: cat('Sport'),
			startDate: dayOf(today, -6, 1)
		}),
		3_490,
		contract(addDays(today, 50), 1)
	);
	await add(
		item({
			accountId: giro.id,
			name: 'Rundfunkbeitrag',
			counterparty: 'Beitragsservice',
			categoryId: cat('Rundfunkbeitrag'),
			interval: 'quarterly',
			startDate: dayOf(today, -5, 15)
		}),
		5_508
	);
	await add(
		item({
			accountId: giro.id,
			name: 'Kfz-Versicherung',
			counterparty: 'Versicherung Beispiel',
			categoryId: cat('Kfz-Versicherung'),
			interval: 'yearly',
			startDate: dayOf(today, 2, 1)
		}),
		48_600
	);
	await add(
		item({
			accountId: giro.id,
			name: 'Haftpflicht',
			counterparty: 'Versicherung Beispiel',
			categoryId: cat('Haftpflicht'),
			interval: 'yearly',
			startDate: dayOf(today, -3, 10)
		}),
		6_800
	);
	await add(
		item({
			accountId: haushalt.id,
			name: 'Handyvertrag',
			counterparty: 'Mobilfunk Muster',
			categoryId: cat('Internet und Telefon'),
			startDate: dayOf(today, -6, 20)
		}),
		2_499
	);
	await add(
		item({
			accountId: card.id,
			name: 'Streaming',
			counterparty: 'Streamingdienst',
			categoryId: cat('Abos und Streaming'),
			startDate: dayOf(today, -6, 9)
		}),
		1_399
	);
	await add(
		item({
			accountId: card.id,
			name: 'Musik',
			counterparty: 'Musikdienst',
			categoryId: cat('Abos und Streaming'),
			startDate: dayOf(today, -6, 12)
		}),
		1_099
	);
	await add(
		item({
			accountId: giro.id,
			kind: 'transfer',
			targetAccountId: haushalt.id,
			name: 'Haushaltsgeld',
			counterparty: null,
			startDate: dayOf(today, -6, 28),
			paymentMethod: 'standing_order'
		}),
		120_000
	);
	await add(
		item({
			accountId: giro.id,
			kind: 'transfer',
			targetAccountId: tagesgeld.id,
			name: 'Sparplan',
			counterparty: null,
			startDate: dayOf(today, -6, 1),
			paymentMethod: 'standing_order'
		}),
		30_000
	);
	await add(
		item({
			accountId: giro.id,
			name: 'Kita',
			counterparty: 'Kita Sonnenschein',
			categoryId: cat('Betreuung und Schule'),
			startDate: dayOf(today, -6, 2)
		}),
		38_000
	);
	await add(
		item({
			accountId: giro.id,
			name: 'Autokredit',
			counterparty: 'Beispielbank',
			categoryId: cat('Werkstatt'),
			startDate: dayOf(today, -6, 15),
			endDate: dayOf(today, 30, 15)
		}),
		28_900
	);
	await add(
		item({
			accountId: giro.id,
			name: 'Nachhilfe',
			counterparty: 'Lernstudio Muster',
			categoryId: cat('Betreuung und Schule'),
			startDate: dayOf(today, -2, 25),
			paymentMethod: 'manual'
		}),
		12_000
	);

	// Everyday spending (fixed per day, so a reset shows the same picture).
	const spend = demoBookings(opening, today, Number(today.replace(/-/g, '')) % 100_000);
	for (let i = 0; i < spend.length; i += 200)
		await db.insert(bookings).values(
			spend.slice(i, i + 200).map((b) => ({
				accountId: b.card ? card.id : haushalt.id,
				bookingDate: b.date,
				amount: b.amount,
				counterparty: b.payee,
				categoryId: cat(b.category),
				source: 'manual' as const,
				createdBy: alex.id
			}))
		);

	await db.insert(budgets).values([
		{ categoryId: cat('Lebensmittel'), accountId: haushalt.id, amount: 45_000, createdBy: alex.id },
		{ categoryId: cat('Freizeit'), ownerId: alex.id, amount: 20_000, createdBy: alex.id }
	]);
	await db.insert(savingsGoals).values({
		accountId: tagesgeld.id,
		name: 'Sommerurlaub',
		targetAmount: 250_000,
		targetDate: addMonths(today, 6),
		allocated: 140_000,
		since: today,
		createdBy: alex.id
	});
	await syncDues();
}

/** Empties every table of the app and fills the demo again. */
export async function resetDemo() {
	const tables = await db.execute<{ name: string }>(
		sql`select tablename as name from pg_tables where schemaname = 'public'`
	);
	if (tables.length)
		await db.execute(
			sql.raw(
				`truncate ${tables.map((t) => `"${t.name.replace(/"/g, '')}"`).join(', ')} restart identity cascade`
			)
		);
	await seedDemo();
}

let lastReset: string | null = null;

/** Hourly: once a night (from 3 o'clock Berlin) back to the start. */
export async function nightlyDemoReset(now = new Date()): Promise<number> {
	if (!isDemo()) return 0;
	const today = todayBerlin(now);
	const hour = Number(
		new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Europe/Berlin',
			hour: '2-digit',
			hourCycle: 'h23'
		}).format(now)
	);
	if (lastReset === today || hour < 3) return 0;
	if (lastReset === null) {
		// After a (re)start the data was just checked; reset from the next night on.
		lastReset = today;
		return 0;
	}
	lastReset = today;
	await resetDemo();
	return 1;
}

/** At start: an empty demo database gets its data. */
export async function prepareDemo() {
	if (!isDemo() || (await demoUserId())) return;
	await seedDemo();
}
