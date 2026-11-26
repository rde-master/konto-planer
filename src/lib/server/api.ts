import { and, desc, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { apiTokens, appSettings, users } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import type { Viewer } from './account-rules.js';
import { generateSessionToken, hashSessionToken } from './session-token.js';
import { listAccountsFor } from './accounts.js';
import { balancesOf } from './bookings.js';
import { plansFor } from './minimum.js';
import { listRecurringFor } from './recurring.js';
import { budgetsFor } from './budgets.js';
import { balanceDates } from './import-reminder.js';
import { haSetState, listRules, missingPayments, notifySettings } from './notify.js';
import { openPayments } from '../due.js';
import { haSensors, statusJson, TOKEN_PURPOSES, type StatusAccount } from '../api.js';
import { addDays } from '../recurring.js';
import { formatDay, todayBerlin } from '../dates.js';
import { formatEuro } from '../money.js';

export class ApiError extends Error {}

export async function listTokens(userId: string) {
	return db
		.select({
			id: apiTokens.id,
			name: apiTokens.name,
			purpose: apiTokens.purpose,
			accountIds: apiTokens.accountIds,
			createdAt: apiTokens.createdAt,
			lastUsedAt: apiTokens.lastUsedAt
		})
		.from(apiTokens)
		.where(eq(apiTokens.userId, userId))
		.orderBy(desc(apiTokens.createdAt));
}

/** New token; returns it once (only the hash is stored). */
export async function createToken(
	actor: NonNullable<Actor> & Viewer,
	input: { name: string; purpose: string; accountIds: string[] | null }
) {
	const name = input.name.trim().replace(/\s+/g, ' ');
	if (!name) throw new ApiError('Bitte einen Namen eingeben.');
	if (name.length > 60) throw new ApiError('Höchstens 60 Zeichen.');
	const purpose = TOKEN_PURPOSES.find((p) => p === input.purpose) ?? 'other';
	const visible = new Set((await listAccountsFor(actor)).map((a) => a.id));
	const accountIds = input.accountIds ? input.accountIds.filter((id) => visible.has(id)) : null;
	if (accountIds && !accountIds.length) throw new ApiError('Bitte mindestens ein Konto wählen.');
	const token = generateSessionToken();
	await db.transaction(async (tx) => {
		const [row] = await tx
			.insert(apiTokens)
			.values({ userId: actor.id, name, purpose, accountIds, tokenHash: hashSessionToken(token) })
			.returning({ id: apiTokens.id });
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'API-Zugang',
			after: { apiToken: `${name} angelegt (${row.id.slice(0, 8)})` }
		});
	});
	return { token, purpose };
}

export async function revokeToken(actor: NonNullable<Actor>, id: string) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return;
	await db.transaction(async (tx) => {
		const gone = await tx
			.delete(apiTokens)
			.where(and(eq(apiTokens.id, id), eq(apiTokens.userId, actor.id)))
			.returning({ name: apiTokens.name });
		if (!gone.length) return;
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'API-Zugang',
			after: { apiToken: `${gone[0].name} widerrufen` }
		});
	});
}

/** Viewer and accounts of a request's bearer token (null = missing or unknown). */
export async function tokenAuth(request: Request) {
	const header = request.headers.get('authorization') ?? '';
	const token = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/i.exec(header.trim())?.[1];
	if (!token) return null;
	const [row] = await db
		.select({ token: apiTokens, user: users })
		.from(apiTokens)
		.innerJoin(users, eq(users.id, apiTokens.userId))
		.where(eq(apiTokens.tokenHash, hashSessionToken(token)));
	if (!row || (row.user.role !== 'admin' && row.user.role !== 'user')) return null;
	await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.token.id));
	const viewer: Viewer = { id: row.user.id, role: row.user.role };
	return { viewer, accountIds: row.token.accountIds };
}

/** The status document for a viewer, limited to `accountIds` (null = all visible). */
export async function statusFor(
	viewer: Viewer,
	accountIds: string[] | null,
	today = todayBerlin()
) {
	const accounts = (await listAccountsFor(viewer)).filter(
		(a) => !a.archivedAt && (!accountIds || accountIds.includes(a.id))
	);
	const ids = new Set(accounts.map((a) => a.id));
	const [balances, asOf, items, budgets, rules] = await Promise.all([
		balancesOf(accounts),
		balanceDates(accounts, today),
		listRecurringFor(viewer),
		budgetsFor(viewer, today.slice(0, 7)),
		listRules()
	]);
	const plans = await plansFor(viewer, accounts, balances);
	const upcoming = openPayments(
		items.filter((i) => !i.archivedAt),
		ids,
		today,
		addDays(today, 90)
	);
	const tolerance = rules.find((r) => r.type === 'payment_missing')?.toleranceDays ?? 3;
	const missing = ids.size ? await missingPayments(today, tolerance, [...ids]) : [];

	const warnings: { type: string; account: string; text: string }[] = [];
	const list: StatusAccount[] = accounts.map((a) => {
		const balance = balances.get(a.id) ?? a.openingBalance;
		const plan = plans.get(a.id);
		const next = upcoming.find((p) => p.accountId === a.id);
		if (balance < 0 && a.type === 'giro')
			warnings.push({
				type: 'overdraft_reached',
				account: a.name,
				text: `${a.name} steht mit ${formatEuro(balance)} im Minus.`
			});
		if (a.type === 'kreditkarte' && a.overdraftLimit && balance < -a.overdraftLimit)
			warnings.push({
				type: 'credit_limit',
				account: a.name,
				text: `${a.name} liegt über dem Kreditrahmen.`
			});
		if (plan && plan.plan.available < 0)
			warnings.push({
				type: 'minimum_shortfall',
				account: a.name,
				text: `Auf ${a.name} fehlen ${formatEuro(-plan.plan.available)} bis zum ${formatDay(plan.cutoff.date)}.`
			});
		if (plan?.plan.exceedsOverdraft)
			warnings.push({
				type: 'overdraft_risk',
				account: a.name,
				text: `Der Dispo von ${a.name} reicht nach Plan nicht.`
			});
		return {
			id: a.id,
			name: a.name,
			type: a.type,
			balance,
			asOf: asOf.get(a.id)?.date ?? null,
			available: plan?.plan.available ?? null,
			minimum: plan?.plan.minimum ?? null,
			cutoff: plan?.cutoff.date ?? null,
			nextPayment: next ? { name: next.name, amount: next.amount, date: next.bookingDate } : null
		};
	});
	for (const m of missing)
		warnings.push({
			type: 'payment_missing',
			account: m.accountName,
			text: `${m.name} (${formatDay(m.bookingDate)}) ist im Import nicht aufgetaucht.`
		});
	return statusJson({
		generatedAt: new Date(),
		accounts: list,
		budgets: budgets
			.filter((b) => !b.accountId || ids.has(b.accountId))
			.map((b) => ({
				category: b.categoryName,
				account: b.accountName,
				limit: b.limit,
				spent: b.spent,
				state: b.state
			})),
		warnings
	});
}

/** Admin view for the hourly push (every account, like the notification job). */
const SYSTEM: Viewer = { id: '00000000-0000-0000-0000-000000000000', role: 'admin' };

export async function haSensorsEnabled() {
	const [row] = await db
		.select({ on: appSettings.haSensors })
		.from(appSettings)
		.where(eq(appSettings.id, 1));
	return row?.on ?? false;
}

export async function setHaSensors(actor: NonNullable<Actor>, on: boolean) {
	await db.transaction(async (tx) => {
		await tx
			.update(appSettings)
			.set({ haSensors: on, updatedAt: new Date() })
			.where(eq(appSettings.id, 1));
		await audit(tx, {
			actor,
			entityType: 'settings',
			action: 'update',
			entityLabel: 'Home Assistant',
			after: { haSensors: on }
		});
	});
}

/** Writes the status as sensors to Home Assistant; returns the number of sensors. */
export async function pushHaSensors({ force = false } = {}): Promise<number> {
	if (!force && !(await haSensorsEnabled())) return 0;
	const { ha } = await notifySettings();
	if (!ha) throw new ApiError('Home Assistant ist noch nicht eingerichtet.');
	const sensors = haSensors(await statusFor(SYSTEM, null));
	for (const s of sensors) await haSetState(ha, s.entity, s.state, s.attributes);
	return sensors.length;
}
