import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { sessions, users } from './db/schema.js';
import { hashPassword, verifyPassword } from './auth.js';
import { checkDelete, checkRoleChange, type Role } from './user-rules.js';
import { normalizeUsername } from './validation.js';
import { hashSessionToken } from './session-token.js';
import { clearFailures } from './login-throttle.js';
import { audit, type Actor } from './audit.js';
import { diff } from './audit-rules.js';

export class UserError extends Error {}

export type UserListItem = {
	id: string;
	username: string;
	name: string;
	email: string | null;
	role: Role;
	createdAt: Date;
};

const listColumns = {
	id: users.id,
	username: users.username,
	name: users.name,
	email: users.email,
	role: users.role,
	createdAt: users.createdAt
};

/** Fields of a user that appear in the audit log (never the password hash). */
const auditColumns = {
	name: users.name,
	username: users.username,
	email: users.email,
	role: users.role
};

export function listUsers(): Promise<UserListItem[]> {
	return db.select(listColumns).from(users).orderBy(asc(users.name));
}

export async function getUser(id: string): Promise<UserListItem | undefined> {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
	const [user] = await db.select(listColumns).from(users).where(eq(users.id, id));
	return user;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Serialises admin-count checks so two parallel requests cannot remove the last admin.
async function lockUsers(tx: Tx) {
	await tx.execute(sql`lock table users in share row exclusive mode`);
}

async function adminCount(tx: Tx): Promise<number> {
	const [row] = await tx.select({ n: count() }).from(users).where(eq(users.role, 'admin'));
	return row?.n ?? 0;
}

export async function createUser(
	actor: Actor,
	input: { name: string; username: string; email: string; role: Role; password: string }
): Promise<string> {
	const passwordHash = await hashPassword(input.password);
	const values = {
		name: input.name.trim(),
		username: normalizeUsername(input.username),
		email: input.email.trim() || null,
		role: input.role
	};
	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(users)
			.values({ ...values, passwordHash })
			.onConflictDoNothing({ target: users.username })
			.returning({ id: users.id });
		if (!created) throw new UserError('Dieser Benutzername ist schon vergeben.');
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'create',
			entityId: created.id,
			entityLabel: values.name,
			after: values
		});
		return created.id;
	});
}

export async function updateUser(
	actor: NonNullable<Actor>,
	targetId: string,
	input: { name: string; email: string; role: Role }
) {
	await db.transaction(async (tx) => {
		await lockUsers(tx);
		const [target] = await tx.select(auditColumns).from(users).where(eq(users.id, targetId));
		if (!target) throw new UserError('Benutzer nicht gefunden.');
		const problem = checkRoleChange({
			actorId: actor.id,
			targetId,
			currentRole: target.role,
			newRole: input.role,
			adminCount: await adminCount(tx)
		});
		if (problem) throw new UserError(problem);
		const next = { name: input.name.trim(), email: input.email.trim() || null, role: input.role };
		await tx
			.update(users)
			.set({ ...next, updatedAt: new Date() })
			.where(eq(users.id, targetId));
		const changes = diff(target, { ...target, ...next });
		if (changes) {
			await audit(tx, {
				actor,
				entityType: 'user',
				action: 'update',
				entityId: targetId,
				entityLabel: next.name,
				...changes
			});
		}
	});
}

export async function deleteUser(actor: NonNullable<Actor>, targetId: string) {
	await db.transaction(async (tx) => {
		await lockUsers(tx);
		const [target] = await tx.select(auditColumns).from(users).where(eq(users.id, targetId));
		if (!target) throw new UserError('Benutzer nicht gefunden.');
		const problem = checkDelete({
			actorId: actor.id,
			targetId,
			targetRole: target.role,
			adminCount: await adminCount(tx)
		});
		if (problem) throw new UserError(problem);
		await tx.delete(users).where(eq(users.id, targetId));
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'delete',
			entityId: targetId,
			entityLabel: target.name,
			before: target
		});
	});
}

/** Admin reset: sets a new password, lifts a login lock and signs the user out on all devices. */
export async function resetPassword(actor: Actor, targetId: string, password: string) {
	const passwordHash = await hashPassword(password);
	await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(users)
			.set({ passwordHash, updatedAt: new Date() })
			.where(eq(users.id, targetId))
			.returning({ username: users.username, name: users.name });
		if (!updated) throw new UserError('Benutzer nicht gefunden.');
		await tx.delete(sessions).where(eq(sessions.userId, targetId));
		await clearFailures(updated.username, tx);
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'password_reset',
			entityId: targetId,
			entityLabel: updated.name
		});
	});
}

/** Admin unlock after too many failed logins. */
export async function unlockUser(actor: Actor, targetId: string) {
	const user = await getUser(targetId);
	if (!user) throw new UserError('Benutzer nicht gefunden.');
	await db.transaction(async (tx) => {
		await clearFailures(user.username, tx);
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'unlock',
			entityId: user.id,
			entityLabel: user.name
		});
	});
}

/** Own password change: requires the current password and signs out all other devices. */
export async function changeOwnPassword(
	actor: NonNullable<Actor>,
	currentSessionToken: string,
	currentPassword: string,
	newPassword: string
) {
	const [user] = await db
		.select({ passwordHash: users.passwordHash })
		.from(users)
		.where(eq(users.id, actor.id));
	if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
		throw new UserError('Das aktuelle Passwort ist falsch.');
	}
	const passwordHash = await hashPassword(newPassword);
	await db.transaction(async (tx) => {
		await tx
			.update(users)
			.set({ passwordHash, updatedAt: new Date() })
			.where(eq(users.id, actor.id));
		await tx
			.delete(sessions)
			.where(
				and(eq(sessions.userId, actor.id), ne(sessions.id, hashSessionToken(currentSessionToken)))
			);
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'password_change',
			entityId: actor.id,
			entityLabel: actor.name
		});
	});
}
