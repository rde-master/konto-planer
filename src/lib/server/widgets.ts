import { and, desc, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { users, widgets } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import type { Viewer } from './account-rules.js';
import { generateSessionToken, hashSessionToken } from './session-token.js';
import { listAccountsFor } from './accounts.js';
import { balancesOf } from './bookings.js';
import { plansFor } from './minimum.js';
import { listRecurringFor } from './recurring.js';
import { openPayments } from '../due.js';
import {
	TEMPLATE_INFO,
	WIDGET_SIZES,
	WIDGET_TEMPLATES,
	widgetBlocks,
	widgetScript,
	type WidgetData,
	type WidgetSize,
	type WidgetTemplate
} from '../widgets.js';
import { addDays } from '../recurring.js';
import { todayBerlin } from '../dates.js';

export class WidgetError extends Error {}

/** Data for widgets: the viewer's active accounts (optionally some) and payments of 30 days. */
export async function widgetData(
	viewer: Viewer,
	accountIds: string[],
	today = todayBerlin()
): Promise<WidgetData> {
	const accounts = (await listAccountsFor(viewer)).filter(
		(a) => !a.archivedAt && (!accountIds.length || accountIds.includes(a.id))
	);
	const ids = new Set(accounts.map((a) => a.id));
	const [balances, items] = await Promise.all([balancesOf(accounts), listRecurringFor(viewer)]);
	const plans = await plansFor(viewer, accounts, balances);
	return {
		accounts: accounts.map((a) => {
			const plan = plans.get(a.id);
			return {
				id: a.id,
				name: a.name,
				type: a.type,
				balance: balances.get(a.id) ?? a.openingBalance,
				available: plan?.plan.available ?? null,
				minimum: plan?.plan.minimum ?? null,
				cutoff: plan?.cutoff.date ?? null
			};
		}),
		payments: openPayments(
			items.filter((i) => !i.archivedAt),
			ids,
			addDays(today, 1),
			addDays(today, 30)
		).map((p) => ({ name: p.name, date: p.bookingDate, amount: p.amount, accountId: p.accountId }))
	};
}

export async function listWidgets(userId: string) {
	return db
		.select({
			id: widgets.id,
			name: widgets.name,
			template: widgets.template,
			size: widgets.size,
			accountIds: widgets.accountIds,
			createdAt: widgets.createdAt,
			lastUsedAt: widgets.lastUsedAt
		})
		.from(widgets)
		.where(eq(widgets.userId, userId))
		.orderBy(desc(widgets.createdAt));
}

/** New widget with its own token; returns the Scriptable script (token inside, shown once). */
export async function createWidget(
	actor: NonNullable<Actor> & Viewer,
	input: { template: string; size: string; accountIds: string[] },
	origin: string
) {
	const template = WIDGET_TEMPLATES.find((t) => t === input.template);
	const size = WIDGET_SIZES.find((s) => s === input.size);
	if (!template || !size) throw new WidgetError('Bitte Vorlage und Größe wählen.');
	const visible = new Set(
		(await listAccountsFor(actor)).filter((a) => !a.archivedAt).map((a) => a.id)
	);
	const accountIds = input.accountIds.filter((id) => visible.has(id));
	const token = generateSessionToken();
	const name = TEMPLATE_INFO[template].title;
	const id = await db.transaction(async (tx) => {
		const [row] = await tx
			.insert(widgets)
			.values({
				userId: actor.id,
				name,
				template,
				size,
				accountIds,
				tokenHash: hashSessionToken(token)
			})
			.returning({ id: widgets.id });
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'Widget',
			after: { widget: `${name} (${size}) angelegt` }
		});
		return row.id;
	});
	return { id, script: widgetScript({ url: `${origin}/api/widget`, token, id, name }) };
}

export async function revokeWidget(actor: NonNullable<Actor>, id: string) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return;
	await db.transaction(async (tx) => {
		const gone = await tx
			.delete(widgets)
			.where(and(eq(widgets.id, id), eq(widgets.userId, actor.id)))
			.returning({ name: widgets.name });
		if (!gone.length) return;
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'Widget',
			after: { widget: `${gone[0].name} widerrufen` }
		});
	});
}

/** What `/api/widget` returns for a widget token (null = unknown). */
export async function widgetResponse(request: Request) {
	const header = request.headers.get('authorization') ?? '';
	const token = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/i.exec(header.trim())?.[1];
	if (!token) return null;
	const [row] = await db
		.select({ widget: widgets, user: users })
		.from(widgets)
		.innerJoin(users, eq(users.id, widgets.userId))
		.where(eq(widgets.tokenHash, hashSessionToken(token)));
	if (!row || (row.user.role !== 'admin' && row.user.role !== 'user')) return null;
	await db.update(widgets).set({ lastUsedAt: new Date() }).where(eq(widgets.id, row.widget.id));
	const viewer: Viewer = { id: row.user.id, role: row.user.role };
	const data = await widgetData(viewer, row.widget.accountIds);
	const origin = process.env.ORIGIN?.trim();
	return {
		name: row.widget.name,
		size: row.widget.size as WidgetSize,
		generatedAt: new Date().toISOString(),
		appUrl: origin?.startsWith('http') ? origin : null,
		blocks: widgetBlocks(row.widget.template as WidgetTemplate, row.widget.size as WidgetSize, data)
	};
}
