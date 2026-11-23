import {
	bigserial,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['admin', 'user']);

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	username: text('username').notNull().unique(),
	name: text('name').notNull(),
	email: text('email'),
	passwordHash: text('password_hash').notNull(),
	role: userRole('role').notNull().default('user'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable(
	'sessions',
	{
		/** SHA-256 of the session token; the token itself is only stored in the cookie. */
		id: text('id').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		userAgent: text('user_agent')
	},
	(t) => [index('sessions_user_id_idx').on(t.userId)]
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;

/**
 * Failed logins per (normalised) username – also for unknown names, so a lock reveals nothing
 * about which accounts exist. Deleted on successful login or admin unlock.
 */
export const loginThrottle = pgTable('login_throttle', {
	username: text('username').primaryKey(),
	failedCount: integer('failed_count').notNull().default(0),
	lastFailedAt: timestamp('last_failed_at', { withTimezone: true }),
	lockedUntil: timestamp('locked_until', { withTimezone: true })
});

/** Audit log: who changed what and when. Visible to admins only. Never contains secrets. */
export const auditLog = pgTable(
	'audit_log',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
		/** Null for anonymous events (failed login) or when the user was deleted. */
		actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
		/** Snapshot of the actor's name so entries stay readable after the user is deleted. */
		actorName: text('actor_name'),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id'),
		/** Readable name of the object, e.g. the user's name. */
		entityLabel: text('entity_label'),
		action: text('action').notNull(),
		before: jsonb('before'),
		after: jsonb('after')
	},
	(t) => [
		index('audit_log_at_idx').on(t.at),
		index('audit_log_actor_idx').on(t.actorId),
		index('audit_log_entity_idx').on(t.entityType, t.entityId)
	]
);
