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
	DEFAULT_STYLE,
	TEMPLATE_LAYOUTS,
	layoutBlocks,
	parseLayout,
	widgetPalette,
	type WidgetLayout,
	TEMPLATE_INFO,
	WIDGET_SIZES,
	WIDGET_TEMPLATES,
	widgetScript,
	type WidgetData,
	type WidgetSize
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
				color: a.color,
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
			layout: widgets.layout,
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
	input: {
		template: string;
		size: string;
		accountIds: string[];
		name?: string;
		layout?: unknown;
	},
	origin: string
) {
	const template =
		input.template === 'custom' ? 'custom' : WIDGET_TEMPLATES.find((t) => t === input.template);
	const size = WIDGET_SIZES.find((s) => s === input.size);
	if (!template || !size) throw new WidgetError('Bitte Vorlage und Größe wählen.');
	const layout = input.layout === undefined ? null : parseLayout(input.layout);
	if (input.layout !== undefined && !layout) throw new WidgetError('Das Layout ist ungültig.');
	const visible = new Set(
		(await listAccountsFor(actor)).filter((a) => !a.archivedAt).map((a) => a.id)
	);
	const accountIds = input.accountIds.filter((id) => visible.has(id));
	const token = generateSessionToken();
	const name =
		cleanName(input.name ?? '') ??
		(template === 'custom' ? 'Eigenes Widget' : TEMPLATE_INFO[template].title);
	const id = await db.transaction(async (tx) => {
		const [row] = await tx
			.insert(widgets)
			.values({
				userId: actor.id,
				name,
				template,
				size,
				accountIds,
				layout,
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

function cleanName(input: string): string | null {
	const name = input.trim().replace(/\s+/g, ' ').slice(0, 40);
	return name || null;
}

/** The layout a widget shows (its own or the template's). */
export function layoutOf(w: { template: string; layout: WidgetLayout | null }): WidgetLayout {
	if (w.layout) return w.layout;
	const t = WIDGET_TEMPLATES.find((x) => x === w.template) ?? 'available';
	return { items: TEMPLATE_LAYOUTS[t], style: DEFAULT_STYLE };
}

export async function getWidget(userId: string, id: string) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
	const [row] = await db
		.select()
		.from(widgets)
		.where(and(eq(widgets.id, id), eq(widgets.userId, userId)));
	return row ?? null;
}

/** Editor: name, size, accounts and layout; the phone shows it on its next refresh. */
export async function saveWidget(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	input: { name: string; size: string; accountIds: string[]; layout: unknown }
) {
	const current = await getWidget(actor.id, id);
	if (!current) throw new WidgetError('Widget nicht gefunden.');
	const size = WIDGET_SIZES.find((s) => s === input.size);
	const layout = parseLayout(input.layout);
	if (!size || !layout) throw new WidgetError('Das Layout ist ungültig.');
	const visible = new Set(
		(await listAccountsFor(actor)).filter((a) => !a.archivedAt).map((a) => a.id)
	);
	const name = cleanName(input.name) ?? current.name;
	await db.transaction(async (tx) => {
		await tx
			.update(widgets)
			.set({
				name,
				size,
				layout,
				accountIds: input.accountIds.filter((a) => visible.has(a))
			})
			.where(eq(widgets.id, id));
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'Widget',
			after: { widget: `${name} geändert` }
		});
	});
}

/** New token and script for an existing widget (the old script stops working). */
export async function renewScript(actor: NonNullable<Actor>, id: string, origin: string) {
	const current = await getWidget(actor.id, id);
	if (!current) throw new WidgetError('Widget nicht gefunden.');
	const token = generateSessionToken();
	await db.transaction(async (tx) => {
		await tx
			.update(widgets)
			.set({ tokenHash: hashSessionToken(token) })
			.where(eq(widgets.id, id));
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'Widget',
			after: { widget: `${current.name}: neues Skript` }
		});
	});
	return widgetScript({ url: `${origin}/api/widget`, token, id, name: current.name });
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
	const layout = layoutOf(row.widget);
	const size = row.widget.size as WidgetSize;
	return {
		name: row.widget.name,
		size,
		generatedAt: new Date().toISOString(),
		appUrl: origin?.startsWith('http') ? origin : null,
		blocks: layoutBlocks(layout.items, size, data),
		style: widgetPalette(layout.style, data.accounts[0]?.color ?? null)
	};
}
