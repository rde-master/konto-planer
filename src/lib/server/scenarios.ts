import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { accounts, scenarioChanges, scenarios } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import type { Viewer } from './account-rules.js';
import { getAccountFor, listAccountsFor, type AccountWithLevel } from './accounts.js';
import { balanceOf } from './bookings.js';
import { plansFor } from './minimum.js';
import { forecastFor } from './forecast.js';
import { listRecurringFor, type RecurringSummary } from './recurring.js';
import { isValidDate } from './recurring-rules.js';
import type { FieldErrors } from './validation.js';
import { applyChanges, CHANGE_KINDS, WHATIF_INTERVALS, type Change } from '../whatif.js';
import { fixedCostsByMonth } from '../reports.js';
import { parseEuro } from '../money.js';
import { todayBerlin } from '../dates.js';

export class ScenarioError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Giro accounts the viewer sees (a scenario changes nothing, so seeing is enough). */
export async function scenarioAccounts(viewer: Viewer) {
	return (await listAccountsFor(viewer)).filter((a) => a.type === 'giro' && !a.archivedAt);
}

export async function listScenarios(viewer: Viewer) {
	return db
		.select({
			id: scenarios.id,
			name: scenarios.name,
			accountName: accounts.name,
			updatedAt: scenarios.updatedAt
		})
		.from(scenarios)
		.innerJoin(accounts, eq(accounts.id, scenarios.accountId))
		.where(eq(scenarios.ownerId, viewer.id))
		.orderBy(desc(scenarios.updatedAt));
}

async function requireOwn(viewer: Viewer, id: string) {
	if (!UUID.test(id)) throw new ScenarioError('Szenario nicht gefunden.');
	const [row] = await db
		.select()
		.from(scenarios)
		.where(and(eq(scenarios.id, id), eq(scenarios.ownerId, viewer.id)));
	if (!row) throw new ScenarioError('Szenario nicht gefunden.');
	const account = await getAccountFor(viewer, row.accountId);
	if (!account) throw new ScenarioError('Szenario nicht gefunden.');
	return { scenario: row, account };
}

function cleanName(input: string): { name: string; error: null } | { name: null; error: string } {
	const name = input.trim().replace(/\s+/g, ' ');
	if (!name) return { name: null, error: 'Bitte einen Namen eingeben.' };
	if (name.length > 60) return { name: null, error: 'Höchstens 60 Zeichen.' };
	return { name, error: null };
}

export async function createScenario(
	actor: NonNullable<Actor> & Viewer,
	input: { name: string; accountId: string }
) {
	const { name, error } = cleanName(input.name);
	if (error !== null) throw new ScenarioError(error);
	const account = (await scenarioAccounts(actor)).find((a) => a.id === input.accountId);
	if (!account) throw new ScenarioError('Bitte ein Girokonto wählen.');
	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(scenarios)
			.values({ ownerId: actor.id, accountId: account.id, name })
			.returning();
		await audit(tx, {
			actor,
			entityType: 'scenario',
			action: 'create',
			entityId: created.id,
			entityLabel: name,
			after: { name, account: account.name }
		});
		return created.id;
	});
}

export async function renameScenario(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	input: string
) {
	const { scenario } = await requireOwn(actor, id);
	const { name, error } = cleanName(input);
	if (error !== null) throw new ScenarioError(error);
	await db.transaction(async (tx) => {
		await tx.update(scenarios).set({ name, updatedAt: new Date() }).where(eq(scenarios.id, id));
		await audit(tx, {
			actor,
			entityType: 'scenario',
			action: 'update',
			entityId: id,
			entityLabel: name,
			before: { name: scenario.name },
			after: { name }
		});
	});
}

export async function deleteScenario(actor: NonNullable<Actor> & Viewer, id: string) {
	const { scenario } = await requireOwn(actor, id);
	await db.transaction(async (tx) => {
		await tx.delete(scenarios).where(eq(scenarios.id, id));
		await audit(tx, {
			actor,
			entityType: 'scenario',
			action: 'delete',
			entityId: id,
			entityLabel: scenario.name,
			before: { name: scenario.name }
		});
	});
}

export type ChangeInput = {
	kind: string;
	recurringId: string;
	name: string;
	direction: string;
	interval: string;
	amount: string;
	date: string;
};

export function validateChange(
	input: ChangeInput,
	itemIds: Set<string>
): { values: Omit<Change, 'id'>; errors: null } | { values: null; errors: FieldErrors } {
	const errors: FieldErrors = {};
	const kind = CHANGE_KINDS.find((k) => k === input.kind);
	if (!kind) errors.kind = 'Bitte eine Art wählen.';
	if (!isValidDate(input.date)) errors.date = 'Bitte ein Datum wählen.';
	let amount: number | null = null;
	if (kind === 'add' || kind === 'amount') {
		amount = parseEuro(input.amount);
		if (amount === null || amount <= 0) errors.amount = 'Bitte einen Betrag größer 0 eingeben.';
	}
	let recurringId: string | null = null;
	if (kind === 'cancel' || kind === 'amount') {
		if (!itemIds.has(input.recurringId)) errors.recurringId = 'Bitte einen Dauerposten wählen.';
		else recurringId = input.recurringId;
	}
	let name: string | null = null;
	let direction: Change['direction'] = null;
	let interval: Change['interval'] = null;
	if (kind === 'add') {
		name = input.name.trim().replace(/\s+/g, ' ') || null;
		if (!name) errors.name = 'Bitte eine Bezeichnung eingeben.';
		else if (name.length > 60) errors.name = 'Höchstens 60 Zeichen.';
		direction = input.direction === 'income' ? 'income' : 'expense';
		interval = WHATIF_INTERVALS.find((i) => i === input.interval) ?? null;
		if (!interval) errors.interval = 'Bitte ein Intervall wählen.';
	}
	if (Object.keys(errors).length || !kind) return { values: null, errors };
	return {
		values: { kind, recurringId, name, direction, interval, amount, date: input.date },
		errors: null
	};
}

/** Expenses and income of the scenario's account (what can be cancelled or changed). */
async function accountItems(viewer: Viewer, accountId: string) {
	return (await listRecurringFor(viewer)).filter(
		(i) => !i.archivedAt && i.kind !== 'transfer' && i.accountId === accountId
	);
}

export async function addChange(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	input: ChangeInput
) {
	const { scenario } = await requireOwn(actor, id);
	const items = await accountItems(actor, scenario.accountId);
	const { values, errors } = validateChange(input, new Set(items.map((i) => i.id)));
	if (!values) return { errors };
	await db.transaction(async (tx) => {
		await tx.insert(scenarioChanges).values({ ...values, scenarioId: id });
		await tx.update(scenarios).set({ updatedAt: new Date() }).where(eq(scenarios.id, id));
		await audit(tx, {
			actor,
			entityType: 'scenario',
			action: 'update',
			entityId: id,
			entityLabel: scenario.name,
			after: { scenarioChange: values.kind, date: values.date, amount: values.amount }
		});
	});
	return { errors: null };
}

export async function removeChange(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	changeId: string
) {
	const { scenario } = await requireOwn(actor, id);
	if (!UUID.test(changeId)) throw new ScenarioError('Änderung nicht gefunden.');
	await db.transaction(async (tx) => {
		const gone = await tx
			.delete(scenarioChanges)
			.where(and(eq(scenarioChanges.id, changeId), eq(scenarioChanges.scenarioId, id)))
			.returning();
		if (!gone.length) throw new ScenarioError('Änderung nicht gefunden.');
		await audit(tx, {
			actor,
			entityType: 'scenario',
			action: 'update',
			entityId: id,
			entityLabel: scenario.name,
			before: { scenarioChange: gone[0].kind, date: gone[0].date }
		});
	});
}

export type Outcome = {
	available: number;
	minimum: number;
	cutoff: string;
	fixedCosts: number;
	lowest: { date: string; balance: number } | null;
	end: number;
};

async function outcome(
	viewer: Viewer,
	account: AccountWithLevel,
	balance: number,
	today: string,
	transform?: (items: RecurringSummary[]) => RecurringSummary[]
): Promise<Outcome> {
	const [plans, f, items] = await Promise.all([
		plansFor(viewer, [account], new Map([[account.id, balance]]), transform),
		forecastFor(viewer, account, balance, today, transform),
		accountItems(viewer, account.id)
	]);
	const plan = plans.get(account.id)!;
	const own = transform ? transform(items).filter((i) => i.accountId === account.id) : items;
	return {
		available: plan.plan.available,
		minimum: plan.plan.minimum,
		cutoff: plan.cutoff.date,
		fixedCosts: fixedCostsByMonth(own, [today.slice(0, 7)])[0].amount,
		lowest: f.lowest,
		end: f.end
	};
}

/** A scenario with its changes and the outcome before and after. */
export async function scenarioView(viewer: Viewer, id: string) {
	const { scenario, account } = await requireOwn(viewer, id);
	const today = todayBerlin();
	const rows = await db
		.select()
		.from(scenarioChanges)
		.where(eq(scenarioChanges.scenarioId, id))
		.orderBy(asc(scenarioChanges.createdAt));
	const changes: Change[] = rows.map((r) => ({
		id: r.id,
		kind: r.kind as Change['kind'],
		recurringId: r.recurringId,
		name: r.name,
		direction: r.direction as Change['direction'],
		interval: r.interval as Change['interval'],
		amount: r.amount,
		date: r.date
	}));
	const balance = await balanceOf(account);
	const transform = (items: RecurringSummary[]) =>
		applyChanges(items, changes, account.id, (fields) => {
			const template = items.find((i) => i.accountId === account.id) ?? items[0];
			return {
				...template,
				...fields,
				counterparty: null,
				iban: null,
				categoryId: null,
				contract: null,
				amount: fields.amounts[0].amount,
				nextDue: null,
				archivedAt: null,
				variable: false
			};
		});
	const [before, after, items] = await Promise.all([
		outcome(viewer, account, balance, today),
		outcome(viewer, account, balance, today, transform),
		accountItems(viewer, account.id)
	]);
	return {
		scenario,
		account: { id: account.id, name: account.name },
		balance,
		changes,
		items: items.map((i) => ({ id: i.id, name: i.name, kind: i.kind, amount: i.amount })),
		before,
		after
	};
}
