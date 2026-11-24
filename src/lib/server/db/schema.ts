import {
	check,
	bigint,
	bigserial,
	boolean,
	date,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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

export const accountType = pgEnum('account_type', ['giro', 'sparbuch']);
export const accessLevel = pgEnum('access_level', ['view', 'edit']);

/** Bank account. All amounts in euro cents. */
export const accounts = pgTable('accounts', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	type: accountType('type').notNull(),
	color: text('color').notNull().default('blue'),
	/** Normalised (no spaces, upper case); used to check imports. */
	iban: text('iban').unique(),
	/** Balance on `openingDate`; bookings from that day on are added. */
	openingBalance: bigint('opening_balance', { mode: 'number' }).notNull().default(0),
	openingDate: date('opening_date', { mode: 'string' }).notNull(),
	/** Overdraft limit as a positive amount; 0 = none. Only for giro accounts. */
	overdraftLimit: bigint('overdraft_limit', { mode: 'number' }).notNull().default(0),
	archivedAt: timestamp('archived_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Which user may see or edit which account. Admins need no entry. */
export const accountAccess = pgTable(
	'account_access',
	{
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		level: accessLevel('level').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.accountId, t.userId] }),
		index('account_access_user_idx').on(t.userId)
	]
);

export type Account = typeof accounts.$inferSelect;

/**
 * Global category, one level deep: a category without parent is a main category,
 * one with parent a subcategory. Only main categories have a colour; subcategories
 * inherit it. Deleting a main category deletes its subcategories.
 */
export const categories = pgTable(
	'categories',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
			onDelete: 'cascade'
		}),
		color: text('color'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		// Names are unique (case-insensitive) among siblings.
		uniqueIndex('categories_sibling_name_idx').on(
			sql`coalesce(${t.parentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
			sql`lower(${t.name})`
		),
		index('categories_parent_idx').on(t.parentId)
	]
);

export type Category = typeof categories.$inferSelect;

export const recurringKind = pgEnum('recurring_kind', ['expense', 'income', 'transfer']);
export const recurringInterval = pgEnum('recurring_interval', [
	'weekly',
	'monthly',
	'quarterly',
	'semiannual',
	'yearly',
	'custom',
	'once'
]);
export const customUnit = pgEnum('custom_unit', ['day', 'week', 'month']);
export const paymentMethod = pgEnum('payment_method', ['direct_debit', 'standing_order', 'manual']);

/**
 * Recurring income, expense or transfer of an account. The amount lives in `recurring_amounts`.
 * A transfer moves money from `accountId` to `targetAccountId`.
 */
export const recurringItems = pgTable(
	'recurring_items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		kind: recurringKind('kind').notNull(),
		/** Only for transfers: the receiving account (any account of the app). */
		targetAccountId: uuid('target_account_id').references(() => accounts.id, {
			onDelete: 'restrict'
		}),
		/** Display name, e.g. "Miete". */
		name: text('name').notNull(),
		/** Payee or payer as on the bank statement; used for import matching. */
		counterparty: text('counterparty'),
		iban: text('iban'),
		mandateReference: text('mandate_reference'),
		creditorId: text('creditor_id'),
		categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
		interval: recurringInterval('interval').notNull(),
		/** Only for interval "custom": every N units. */
		customEvery: integer('custom_every'),
		customUnit: customUnit('custom_unit'),
		startDate: date('start_date', { mode: 'string' }).notNull(),
		endDate: date('end_date', { mode: 'string' }),
		/** Amount varies; the forecast uses the latest known value. */
		variable: boolean('variable').notNull().default(false),
		isSalary: boolean('is_salary').notNull().default(false),
		paymentMethod: paymentMethod('payment_method'),
		customerNumber: text('customer_number'),
		note: text('note'),
		/** Pause: no due dates from `pauseFrom` to `pauseUntil` (inclusive; null = open). */
		pauseFrom: date('pause_from', { mode: 'string' }),
		pauseUntil: date('pause_until', { mode: 'string' }),
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('recurring_items_account_idx').on(t.accountId),
		index('recurring_items_target_account_idx').on(t.targetAccountId),
		index('recurring_items_category_idx').on(t.categoryId),
		check(
			'recurring_items_pause_check',
			sql`${t.pauseUntil} is null or (${t.pauseFrom} is not null and ${t.pauseUntil} >= ${t.pauseFrom})`
		)
	]
);

/** Amount history: every price change is kept. Amounts are positive cents. */
export const recurringAmounts = pgTable(
	'recurring_amounts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		recurringId: uuid('recurring_id')
			.notNull()
			.references(() => recurringItems.id, { onDelete: 'cascade' }),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		validFrom: date('valid_from', { mode: 'string' }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('recurring_amounts_item_date_idx').on(t.recurringId, t.validFrom)]
);

export type RecurringItem = typeof recurringItems.$inferSelect;
export type RecurringAmount = typeof recurringAmounts.$inferSelect;

export const contractRenewal = pgEnum('contract_renewal', ['indefinite', 'period', 'none']);

/** Contract data of a cancellable expense (1:1 with the recurring item). */
export const contracts = pgTable(
	'contracts',
	{
		recurringId: uuid('recurring_id')
			.primaryKey()
			.references(() => recurringItems.id, { onDelete: 'cascade' }),
		/** End of the (initial) minimum term. */
		termEnd: date('term_end', { mode: 'string' }),
		noticeEvery: integer('notice_every').notNull(),
		noticeUnit: customUnit('notice_unit').notNull(),
		renewal: contractRenewal('renewal').notNull(),
		renewalMonths: integer('renewal_months'),
		/** Reminder lead in days; null = default from the settings. */
		leadDays: integer('lead_days'),
		cancelledOn: date('cancelled_on', { mode: 'string' }),
		/** Address for the cancellation letter. */
		cancelName: text('cancel_name'),
		cancelStreet: text('cancel_street'),
		cancelPostalCode: text('cancel_postal_code'),
		cancelCity: text('cancel_city'),
		cancelEmail: text('cancel_email'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		check('contracts_term_end_check', sql`${t.termEnd} is not null or ${t.renewal} = 'indefinite'`)
	]
);

/** App-wide settings: exactly one row (id 1). */
export const appSettings = pgTable(
	'app_settings',
	{
		id: integer('id').primaryKey().default(1),
		defaultLeadDays: integer('default_lead_days').notNull().default(30),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [check('app_settings_single_row', sql`${t.id} = 1`)]
);

export type ContractRow = typeof contracts.$inferSelect;

/** PDF attachments of a recurring item. The file lives in the data volume as `<id>.pdf`. */
export const recurringAttachments = pgTable(
	'recurring_attachments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		recurringId: uuid('recurring_id')
			.notNull()
			.references(() => recurringItems.id, { onDelete: 'cascade' }),
		fileName: text('file_name').notNull(),
		size: integer('size').notNull(),
		uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('recurring_attachments_item_idx').on(t.recurringId)]
);

export type RecurringAttachment = typeof recurringAttachments.$inferSelect;

export const bookingSource = pgEnum('booking_source', ['manual', 'import', 'adjustment']);

/**
 * Real money movement on an account (positive = in, negative = out, euro cents). Manual entries
 * come from the quick entry; imports and adjustments follow in later versions.
 */
export const bookings = pgTable(
	'bookings',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		bookingDate: date('booking_date', { mode: 'string' }).notNull(),
		valueDate: date('value_date', { mode: 'string' }),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		/** Payee or payer. */
		counterparty: text('counterparty'),
		iban: text('iban'),
		/** "Verwendungszweck" (for manual entries: a free note). */
		purpose: text('purpose'),
		/** "Buchungstext" of the bank, e.g. "Lastschrift". */
		bookingText: text('booking_text'),
		categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
		source: bookingSource('source').notNull(),
		/** Balance after the booking as reported by the bank export. */
		balanceAfter: bigint('balance_after', { mode: 'number' }),
		/** Duplicate check for imports. */
		checksum: text('checksum'),
		/** Recurring item this booking fulfils. */
		recurringId: uuid('recurring_id').references(() => recurringItems.id, {
			onDelete: 'restrict'
		}),
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('bookings_account_date_idx').on(t.accountId, t.bookingDate),
		index('bookings_category_idx').on(t.categoryId),
		index('bookings_recurring_idx').on(t.recurringId),
		check('bookings_amount_not_zero', sql`${t.amount} <> 0`)
	]
);

export type Booking = typeof bookings.$inferSelect;

/**
 * Templates of the quick entry: one tap fills kind, amount, account, category and payee.
 * `ownerId` null = shared with all users; otherwise only the owner sees the template.
 * Amount and account are optional (positive cents; the kind gives the sign).
 */
export const bookingTemplates = pgTable(
	'booking_templates',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		kind: text('kind').notNull(),
		amount: bigint('amount', { mode: 'number' }),
		accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
		categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
		counterparty: text('counterparty'),
		position: integer('position').notNull().default(0),
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		unique('booking_templates_owner_name').on(t.ownerId, t.name).nullsNotDistinct(),
		check('booking_templates_kind', sql`${t.kind} in ('expense', 'income')`),
		check('booking_templates_amount_positive', sql`${t.amount} is null or ${t.amount} > 0`)
	]
);

export type BookingTemplate = typeof bookingTemplates.$inferSelect;
