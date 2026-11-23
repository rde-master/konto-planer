import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { sessions, users } from './db/schema.js';
import { hashPassword, verifyPassword } from './auth.js';
import { checkDelete, checkRoleChange, type Role } from './user-rules.js';
import { normalizeUsername } from './validation.js';
import { hashSessionToken } from './session-token.js';
import { clearFailures } from './login-throttle.js';

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

export async function createUser(input: {
	name: string;
	username: string;
	email: string;
	role: Role;
	password: string;
}): Promise<string> {
	const username = normalizeUsername(input.username);
	const passwordHash = await hashPassword(input.password);
	const [created] = await db
		.insert(users)
		.values({
			name: input.name.trim(),
			username,
			email: input.email.trim() || null,
			role: input.role,
			passwordHash
		})
		.onConflictDoNothing({ target: users.username })
		.returning({ id: users.id });
	if (!created) throw new UserError('Dieser Benutzername ist schon vergeben.');
	return created.id;
}

export async function updateUser(
	actorId: string,
	targetId: string,
	input: { name: string; email: string; role: Role }
) {
	await db.transaction(async (tx) => {
		await lockUsers(tx);
		const [target] = await tx
			.select({ role: users.role })
			.from(users)
			.where(eq(users.id, targetId));
		if (!target) throw new UserError('Benutzer nicht gefunden.');
		const problem = checkRoleChange({
			actorId,
			targetId,
			currentRole: target.role,
			newRole: input.role,
			adminCount: await adminCount(tx)
		});
		if (problem) throw new UserError(problem);
		await tx
			.update(users)
			.set({
				name: input.name.trim(),
				email: input.email.trim() || null,
				role: input.role,
				updatedAt: new Date()
			})
			.where(eq(users.id, targetId));
	});
}

export async function deleteUser(actorId: string, targetId: string) {
	await db.transaction(async (tx) => {
		await lockUsers(tx);
		const [target] = await tx
			.select({ role: users.role })
			.from(users)
			.where(eq(users.id, targetId));
		if (!target) throw new UserError('Benutzer nicht gefunden.');
		const problem = checkDelete({
			actorId,
			targetId,
			targetRole: target.role,
			adminCount: await adminCount(tx)
		});
		if (problem) throw new UserError(problem);
		await tx.delete(users).where(eq(users.id, targetId));
	});
}

/** Admin reset: sets a new password, lifts a login lock and signs the user out on all devices. */
export async function resetPassword(targetId: string, password: string) {
	const passwordHash = await hashPassword(password);
	const username = await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(users)
			.set({ passwordHash, updatedAt: new Date() })
			.where(eq(users.id, targetId))
			.returning({ username: users.username });
		if (!updated) throw new UserError('Benutzer nicht gefunden.');
		await tx.delete(sessions).where(eq(sessions.userId, targetId));
		return updated.username;
	});
	await clearFailures(username);
}

/** Admin unlock after too many failed logins. */
export async function unlockUser(targetId: string) {
	const user = await getUser(targetId);
	if (!user) throw new UserError('Benutzer nicht gefunden.');
	await clearFailures(user.username);
}

/** Own password change: requires the current password and signs out all other devices. */
export async function changeOwnPassword(
	userId: string,
	currentSessionToken: string,
	currentPassword: string,
	newPassword: string
) {
	const [user] = await db
		.select({ passwordHash: users.passwordHash })
		.from(users)
		.where(eq(users.id, userId));
	if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
		throw new UserError('Das aktuelle Passwort ist falsch.');
	}
	const passwordHash = await hashPassword(newPassword);
	await db.transaction(async (tx) => {
		await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
		await tx
			.delete(sessions)
			.where(
				and(eq(sessions.userId, userId), ne(sessions.id, hashSessionToken(currentSessionToken)))
			);
	});
}
