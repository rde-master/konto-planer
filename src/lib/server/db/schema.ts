import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
