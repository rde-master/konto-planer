import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { db } from './db/index.js';
import {
	accountAccess,
	accounts,
	bookings,
	recurringItems,
	savingsGoals,
	users,
	type Account
} from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { diff } from './audit-rules.js';
import { syncDues } from './due.js';
import {
	canEditAccount,
	effectiveLevel,
	type AccessLevel,
	type AccountValues,
	type Viewer
} from './account-rules.js';

export class AccountError extends Error {}

export type AccountWithLevel = Account & { level: AccessLevel };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fields of an account that appear in the audit log. */
function auditFields(a: Pick<Account, keyof AccountValues>) {
	return {
		name: a.name,
		type: a.type,
		color: a.color,
		iban: a.iban,
		openingBalance: a.openingBalance,
		openingDate: a.openingDate,
		overdraftLimit: a.overdraftLimit,
		buffer: a.buffer,
		settlementAccountId: a.settlementAccountId,
		statementDay: a.statementDay,
		debitDay: a.debitDay
	};
}

/** Credit cards are settled from an active giro account; other types keep no card data. */
async function checkCardFields(values: AccountValues, selfId?: string): Promise<AccountValues> {
	if (values.type !== 'kreditkarte')
		return { ...values, settlementAccountId: null, statementDay: null, debitDay: null };
	const [giro] = await db
		.select({ type: accounts.type, archivedAt: accounts.archivedAt })
		.from(accounts)
		.where(eq(accounts.id, values.settlementAccountId ?? ''));
	if (!giro || giro.type !== 'giro' || giro.archivedAt || values.settlementAccountId === selfId)
		throw new AccountError('Bitte ein aktives Girokonto für die Abbuchung wählen.');
	return { ...values, buffer: 0 };
}

function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23505' || err?.cause?.code === '23505';
}

const IBAN_TAKEN = 'Diese IBAN gehört schon zu einem anderen Konto.';

/** All accounts the viewer may see, with the effective access level. */
export async function listAccountsFor(viewer: Viewer): Promise<AccountWithLevel[]> {
	if (viewer.role === 'admin') {
		const rows = await db.select().from(accounts).orderBy(asc(accounts.name));
		return rows.map((a) => ({ ...a, level: 'edit' as const }));
	}
	const rows = await db
		.select({ account: accounts, level: accountAccess.level })
		.from(accountAccess)
		.innerJoin(accounts, eq(accountAccess.accountId, accounts.id))
		.where(eq(accountAccess.userId, viewer.id))
		.orderBy(asc(accounts.name));
	return rows.map((r) => ({ ...r.account, level: r.level }));
}

/** The account if the viewer may see it, otherwise null (callers answer 404). */
export async function getAccountFor(viewer: Viewer, id: string): Promise<AccountWithLevel | null> {
	if (!UUID.test(id)) return null;
	const [row] = await db
		.select({ account: accounts, level: accountAccess.level })
		.from(accounts)
		.leftJoin(
			accountAccess,
			and(eq(accountAccess.accountId, accounts.id), eq(accountAccess.userId, viewer.id))
		)
		.where(eq(accounts.id, id));
	if (!row) return null;
	const level = effectiveLevel(viewer, row.level);
	return level ? { ...row.account, level } : null;
}

/**
 * Whether other data (bookings, recurring items, …) references the account.
 * Accounts with data are archived instead of deleted. Extend this when new
 * tables with an account reference are added.
 */
export async function accountHasData(accountId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: recurringItems.id })
		.from(recurringItems)
		.where(
			or(eq(recurringItems.accountId, accountId), eq(recurringItems.targetAccountId, accountId))
		)
		.limit(1);
	if (row) return true;
	const [booking] = await db
		.select({ id: bookings.id })
		.from(bookings)
		.where(eq(bookings.accountId, accountId))
		.limit(1);
	if (booking) return true;
	const [goal] = await db
		.select({ id: savingsGoals.id })
		.from(savingsGoals)
		.where(eq(savingsGoals.accountId, accountId))
		.limit(1);
	return goal !== undefined;
}

export async function createAccount(
	actor: NonNullable<Actor>,
	values: AccountValues
): Promise<string> {
	values = await checkCardFields(values);
	try {
		return await db.transaction(async (tx) => {
			const [created] = await tx.insert(accounts).values(values).returning();
			await audit(tx, {
				actor,
				entityType: 'account',
				action: 'create',
				entityId: created.id,
				entityLabel: created.name,
				after: auditFields(created)
			});
			return created.id;
		});
	} catch (e) {
		if (isUniqueViolation(e)) throw new AccountError(IBAN_TAKEN);
		throw e;
	}
}

export async function updateAccount(
	actor: NonNullable<Actor> & Viewer,
	id: string,
	values: AccountValues
) {
	const current = await getAccountFor(actor, id);
	if (!current) throw new AccountError('Konto nicht gefunden.');
	if (!canEditAccount(current.level, current.archivedAt !== null)) {
		throw new AccountError('Du darfst dieses Konto nicht bearbeiten.');
	}
	// The type is fixed after creation: savings and giro accounts behave differently.
	const next = await checkCardFields({ ...values, type: current.type }, id);
	if (next.type === 'sparbuch') {
		next.overdraftLimit = 0;
		next.buffer = 0;
	}
	try {
		await db.transaction(async (tx) => {
			await tx
				.update(accounts)
				.set({ ...next, updatedAt: new Date() })
				.where(eq(accounts.id, id));
			const changes = diff(auditFields(current), auditFields({ ...current, ...next }));
			if (changes) {
				await audit(tx, {
					actor,
					entityType: 'account',
					action: 'update',
					entityId: id,
					entityLabel: next.name,
					...changes
				});
			}
		});
	} catch (e) {
		if (isUniqueViolation(e)) throw new AccountError(IBAN_TAKEN);
		throw e;
	}
	// Opening date or archive state decide which due items are booked.
	await syncDues();
}

export async function setArchived(actor: NonNullable<Actor>, id: string, archived: boolean) {
	await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(accounts)
			.set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
			.where(eq(accounts.id, id))
			.returning({ name: accounts.name });
		if (!updated) throw new AccountError('Konto nicht gefunden.');
		await audit(tx, {
			actor,
			entityType: 'account',
			action: archived ? 'archive' : 'restore',
			entityId: id,
			entityLabel: updated.name
		});
	});
	// Opening date or archive state decide which due items are booked.
	await syncDues();
}

export async function deleteAccount(actor: NonNullable<Actor>, id: string) {
	if (await accountHasData(id)) {
		throw new AccountError('Das Konto hat Daten und kann nur archiviert werden.');
	}
	await db.transaction(async (tx) => {
		const [deleted] = await tx.delete(accounts).where(eq(accounts.id, id)).returning();
		if (!deleted) throw new AccountError('Konto nicht gefunden.');
		await audit(tx, {
			actor,
			entityType: 'account',
			action: 'delete',
			entityId: id,
			entityLabel: deleted.name,
			before: auditFields(deleted)
		});
	});
}

export type AccessEntry = { userId: string; name: string; level: AccessLevel | null };

/** Every non-admin user with their level on this account (admins always have full access). */
export async function listAccess(accountId: string): Promise<AccessEntry[]> {
	const rows = await db
		.select({ userId: users.id, name: users.name, level: accountAccess.level })
		.from(users)
		.leftJoin(
			accountAccess,
			and(eq(accountAccess.userId, users.id), eq(accountAccess.accountId, accountId))
		)
		.where(eq(users.role, 'user'))
		.orderBy(asc(users.name));
	return rows;
}

/** Replaces the access list; logs before/after per user name. */
export async function setAccess(
	actor: NonNullable<Actor>,
	accountId: string,
	wanted: Record<string, AccessLevel | null>
) {
	await db.transaction(async (tx) => {
		const [account] = await tx
			.select({ name: accounts.name })
			.from(accounts)
			.where(eq(accounts.id, accountId));
		if (!account) throw new AccountError('Konto nicht gefunden.');
		const ids = Object.keys(wanted);
		const targetUsers = ids.length
			? await tx
					.select({ id: users.id, name: users.name })
					.from(users)
					.where(and(inArray(users.id, ids), eq(users.role, 'user')))
			: [];
		const current = await tx
			.select({ userId: accountAccess.userId, level: accountAccess.level })
			.from(accountAccess)
			.where(eq(accountAccess.accountId, accountId));
		const currentLevel = new Map(current.map((c) => [c.userId, c.level]));

		const before: Record<string, AccessLevel | null> = {};
		const after: Record<string, AccessLevel | null> = {};
		for (const user of targetUsers) {
			const from = currentLevel.get(user.id) ?? null;
			const to = wanted[user.id] ?? null;
			if (from === to) continue;
			before[user.name] = from;
			after[user.name] = to;
			if (to === null) {
				await tx
					.delete(accountAccess)
					.where(and(eq(accountAccess.accountId, accountId), eq(accountAccess.userId, user.id)));
			} else {
				await tx
					.insert(accountAccess)
					.values({ accountId, userId: user.id, level: to })
					.onConflictDoUpdate({
						target: [accountAccess.accountId, accountAccess.userId],
						set: { level: to }
					});
			}
		}
		if (Object.keys(after).length) {
			await audit(tx, {
				actor,
				entityType: 'account',
				action: 'access_change',
				entityId: accountId,
				entityLabel: account.name,
				before,
				after
			});
		}
	});
}
