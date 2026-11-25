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

export const cutoffMode = pgEnum('cutoff_mode', ['salary', 'month_end', 'date']);
export const interestRhythm = pgEnum('interest_rhythm', ['monthly', 'quarterly', 'yearly']);

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
	/** Safety amount always added to the minimum balance; giro accounts only. */
	buffer: bigint('buffer', { mode: 'number' }).notNull().default(0),
	/** Cut-off day of the minimum balance ("Stichtag"); giro accounts only. */
	cutoffMode: cutoffMode('cutoff_mode').notNull().default('salary'),
	/** Mode "salary": the income or transfer that sets the day; null = next salary. */
	cutoffRecurringId: uuid('cutoff_recurring_id').references((): AnyPgColumn => recurringItems.id, {
		onDelete: 'set null'
	}),
	/** Mode "date": the fixed day. */
	cutoffDate: date('cutoff_date', { mode: 'string' }),
	/** Savings accounts: interest is credited at the end of each period. */
	interestRhythm: interestRhythm('interest_rhythm').notNull().default('yearly'),
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

export const bookingSource = pgEnum('booking_source', [
	'manual',
	'import',
	'adjustment',
	'provisional',
	'interest',
	'goal'
]);

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
		/** Import that brought the booking (bank export). */
		importId: uuid('import_id').references((): AnyPgColumn => imports.id, {
			onDelete: 'set null'
		}),
		/** Other side of a transfer between two accounts of the app. */
		counterBookingId: uuid('counter_booking_id').references((): AnyPgColumn => bookings.id, {
			onDelete: 'set null'
		}),
		/** Category of the bank export (a hint only). */
		bankCategory: text('bank_category'),
		creditorId: text('creditor_id'),
		mandateReference: text('mandate_reference'),
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('bookings_account_date_idx').on(t.accountId, t.bookingDate),
		index('bookings_category_idx').on(t.categoryId),
		index('bookings_recurring_idx').on(t.recurringId),
		index('bookings_import_idx').on(t.importId),
		index('bookings_checksum_idx').on(t.accountId, t.checksum),
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

export const dueStatus = pgEnum('due_status', ['provisional', 'skipped', 'booked']);

/**
 * Due items of recurring items that reached their bank day. A provisional due item has a
 * booking (`source = 'provisional'`) on the paying account and, for transfers, one on the
 * receiving account. Future due dates are computed, not stored.
 */
export const dueItems = pgTable(
	'due_items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		recurringId: uuid('recurring_id')
			.notNull()
			.references(() => recurringItems.id, { onDelete: 'cascade' }),
		/** Date of the schedule (before bank-day shifting). */
		dueDate: date('due_date', { mode: 'string' }).notNull(),
		/** Bank day, or the date set by hand. */
		bookingDate: date('booking_date', { mode: 'string' }).notNull(),
		/** Positive cents; the item's kind gives the sign. */
		amount: bigint('amount', { mode: 'number' }).notNull(),
		status: dueStatus('status').notNull().default('provisional'),
		moved: boolean('moved').notNull().default(false),
		amountSet: boolean('amount_set').notNull().default(false),
		bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
		targetBookingId: uuid('target_booking_id').references(() => bookings.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('due_items_recurring_date_idx').on(t.recurringId, t.dueDate),
		index('due_items_booking_idx').on(t.bookingId),
		index('due_items_target_booking_idx').on(t.targetBookingId),
		check('due_items_amount_positive', sql`${t.amount} > 0`)
	]
);

export type DueItem = typeof dueItems.$inferSelect;

/** Interest rate history of a savings account (thousandths of a percent: 2,75 % = 2750). */
export const accountInterestRates = pgTable(
	'account_interest_rates',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'cascade' }),
		rate: integer('rate').notNull(),
		validFrom: date('valid_from', { mode: 'string' }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('account_interest_rates_account_date_idx').on(t.accountId, t.validFrom),
		check('account_interest_rates_range', sql`${t.rate} between 0 and 100000`)
	]
);

/**
 * Interest credited at the end of a period, booked provisionally (`bookings.source = 'interest'`).
 * Untouched credits follow the computation; an amount set by hand is kept.
 */
export const interestCredits = pgTable(
	'interest_credits',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'cascade' }),
		periodEnd: date('period_end', { mode: 'string' }).notNull(),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		amountSet: boolean('amount_set').notNull().default(false),
		bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('interest_credits_account_period_idx').on(t.accountId, t.periodEnd)]
);

export type InterestCredit = typeof interestCredits.$inferSelect;

/**
 * Savings goal on a savings account. `allocated` is the part of the account's balance set
 * aside for it (the sum over an account's goals may not exceed its balance). A goal linked to
 * an expense (`recurringId`) gets a transfer to the paying giro account on each due day from
 * `since` on; for a linked goal the target date is the next due date (not stored).
 */
export const savingsGoals = pgTable(
	'savings_goals',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		name: text('name').notNull(),
		targetAmount: bigint('target_amount', { mode: 'number' }).notNull(),
		/** Only for goals without a linked payment; null = no date (no saving rate). */
		targetDate: date('target_date', { mode: 'string' }),
		recurringId: uuid('recurring_id').references(() => recurringItems.id, {
			onDelete: 'set null'
		}),
		allocated: bigint('allocated', { mode: 'number' }).notNull().default(0),
		/** Due items from this day on get a transfer. */
		since: date('since', { mode: 'string' }).notNull(),
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		unique('savings_goals_account_name').on(t.accountId, t.name),
		index('savings_goals_recurring_idx').on(t.recurringId),
		check('savings_goals_target_positive', sql`${t.targetAmount} > 0`),
		check('savings_goals_allocated_range', sql`${t.allocated} >= 0`)
	]
);

export type SavingsGoal = typeof savingsGoals.$inferSelect;

/**
 * Transfer of a goal from the savings account to the giro account on a due day of the linked
 * payment (`bookings.source = 'goal'`). Amount 0 = nothing was set aside (no bookings).
 * "skipped" = taken back by hand; the row stays so the transfer is not made again.
 */
export const goalTransfers = pgTable(
	'goal_transfers',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		goalId: uuid('goal_id').references(() => savingsGoals.id, { onDelete: 'set null' }),
		dueDate: date('due_date', { mode: 'string' }).notNull(),
		bookingDate: date('booking_date', { mode: 'string' }).notNull(),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		status: text('status').notNull().default('booked'),
		bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
		targetBookingId: uuid('target_booking_id').references(() => bookings.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('goal_transfers_goal_date_idx').on(t.goalId, t.dueDate),
		index('goal_transfers_booking_idx').on(t.bookingId),
		index('goal_transfers_target_booking_idx').on(t.targetBookingId),
		check('goal_transfers_status', sql`${t.status} in ('booked', 'skipped')`),
		check('goal_transfers_amount', sql`${t.amount} >= 0`)
	]
);

export type GoalTransfer = typeof goalTransfers.$inferSelect;

/**
 * Loan repaid by an expense (1:1 with the recurring item): each due date of the item is an
 * installment; interest per installment 30/360 on the remaining debt, the rest repays it.
 * Rate in thousandths of a percent (3,5 % = 3500).
 */
export const loans = pgTable(
	'loans',
	{
		recurringId: uuid('recurring_id')
			.primaryKey()
			.references(() => recurringItems.id, { onDelete: 'cascade' }),
		principal: bigint('principal', { mode: 'number' }).notNull(),
		rate: integer('rate').notNull(),
		/** Payout day; interest runs from here. */
		startDate: date('start_date', { mode: 'string' }).notNull(),
		/** End of the term or of the fixed interest period (optional). */
		termEnd: date('term_end', { mode: 'string' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		check('loans_principal_positive', sql`${t.principal} > 0`),
		check('loans_rate_range', sql`${t.rate} between 0 and 100000`)
	]
);

export type Loan = typeof loans.$inferSelect;

/** Extra repayments ("Sondertilgungen") of a loan. */
export const loanExtraPayments = pgTable(
	'loan_extra_payments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		recurringId: uuid('recurring_id')
			.notNull()
			.references(() => loans.recurringId, { onDelete: 'cascade' }),
		date: date('date', { mode: 'string' }).notNull(),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('loan_extra_payments_loan_idx').on(t.recurringId),
		check('loan_extra_payments_amount_positive', sql`${t.amount} > 0`)
	]
);

export type LoanExtraPayment = typeof loanExtraPayments.$inferSelect;

export const importStatus = pgEnum('import_status', ['draft', 'done']);

/**
 * Import of a bank export (CSV) into a giro account. A draft holds the parsed rows for the
 * preview; once taken over, `rows` is cleared and the counts stay.
 */
export const imports = pgTable(
	'imports',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'cascade' }),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
		fileName: text('file_name').notNull(),
		status: importStatus('status').notNull().default('draft'),
		/** Detected encoding, date and number format (shown in the preview). */
		encoding: text('encoding').notNull(),
		dateFormat: text('date_format').notNull(),
		numberFormat: text('number_format').notNull(),
		rows: jsonb('rows'),
		newCount: integer('new_count').notNull().default(0),
		matchedCount: integer('matched_count').notNull().default(0),
		skippedCount: integer('skipped_count').notNull().default(0),
		adjustmentsRemoved: integer('adjustments_removed').notNull().default(0),
		/** Balance check: "Saldo nach Buchung" of the latest row and the computed balance. */
		checkDate: date('check_date', { mode: 'string' }),
		/** Period of the file. */
		periodFrom: date('period_from', { mode: 'string' }),
		periodTo: date('period_to', { mode: 'string' }),
		bankBalance: bigint('bank_balance', { mode: 'number' }),
		appBalance: bigint('app_balance', { mode: 'number' }),
		/** What the import changed beyond its own bookings, to take it back ("rückgängig"). */
		undo: jsonb('undo'),
		undoneAt: timestamp('undone_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp('completed_at', { withTimezone: true })
	},
	(t) => [index('imports_account_idx').on(t.accountId)]
);

export type Import = typeof imports.$inferSelect;

/**
 * Category chosen last for a payee (key: IBAN, otherwise the lower-case name); imports use it
 * for bookings without a recurring item.
 */
export const counterpartyCategories = pgTable('counterparty_categories', {
	key: text('key').primaryKey(),
	categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const ruleField = pgEnum('rule_field', ['counterparty', 'purpose', 'iban']);
export const ruleOperator = pgEnum('rule_operator', ['contains', 'equals', 'starts_with']);

/**
 * Category rules (global): "Verwendungszweck enthält X → Kategorie Y". The first matching rule
 * by `position` sets the category of imported bookings without a recurring item.
 */
export const categoryRules = pgTable(
	'category_rules',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		field: ruleField('field').notNull(),
		operator: ruleOperator('operator').notNull(),
		value: text('value').notNull(),
		categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
		position: integer('position').notNull().default(0),
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('category_rules_position_idx').on(t.position)]
);

export type CategoryRule = typeof categoryRules.$inferSelect;

/**
 * Parts of a split booking ("Splitbuchung"): amount (signed like the booking) and category.
 * What the parts do not cover stays with the booking's own category.
 */
export const bookingParts = pgTable(
	'booking_parts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		bookingId: uuid('booking_id')
			.notNull()
			.references(() => bookings.id, { onDelete: 'cascade' }),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
		position: integer('position').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('booking_parts_booking_idx').on(t.bookingId),
		check('booking_parts_amount_not_zero', sql`${t.amount} <> 0`)
	]
);

export type BookingPart = typeof bookingParts.$inferSelect;

/** Tags (global), in addition to the category; on bookings and recurring items. */
export const tags = pgTable(
	'tags',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('tags_name_idx').on(sql`lower(${t.name})`)]
);

export type Tag = typeof tags.$inferSelect;

export const bookingTags = pgTable(
	'booking_tags',
	{
		bookingId: uuid('booking_id')
			.notNull()
			.references(() => bookings.id, { onDelete: 'cascade' }),
		tagId: uuid('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' })
	},
	(t) => [
		primaryKey({ columns: [t.bookingId, t.tagId] }),
		index('booking_tags_tag_idx').on(t.tagId)
	]
);

/** Tags of a recurring item apply to all its bookings. */
export const recurringTags = pgTable(
	'recurring_tags',
	{
		recurringId: uuid('recurring_id')
			.notNull()
			.references(() => recurringItems.id, { onDelete: 'cascade' }),
		tagId: uuid('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' })
	},
	(t) => [
		primaryKey({ columns: [t.recurringId, t.tagId] }),
		index('recurring_tags_tag_idx').on(t.tagId)
	]
);

/**
 * Logo chosen by hand for a payee (key as `payeeKey()`: IBAN, otherwise the name). `slug` of
 * Simple Icons, or "-" for no logo (initials). Without a row the logo is matched by name.
 */
export const payeeLogos = pgTable('payee_logos', {
	key: text('key').primaryKey(),
	slug: text('slug').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * Trash ("Papierkorb"): snapshot of a deleted object (its rows across tables and the references
 * that became empty), restorable for 30 days. `accountId` limits who may restore it.
 */
export const trash = pgTable(
	'trash',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		entityType: text('entity_type').notNull(),
		entityId: uuid('entity_id').notNull(),
		label: text('label').notNull(),
		accountId: uuid('account_id'),
		snapshot: jsonb('snapshot').notNull(),
		deletedBy: uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('trash_deleted_at_idx').on(t.deletedAt)]
);

export type TrashEntry = typeof trash.$inferSelect;

/** Shared expense ("gemeinsame Ausgabe"): a booking paid by one user for several. */
export const sharedExpenses = pgTable('shared_expenses', {
	bookingId: uuid('booking_id')
		.primaryKey()
		.references(() => bookings.id, { onDelete: 'cascade' }),
	payerId: uuid('payer_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Share of each participant in basis points (10000 = 100 %). */
export const sharedExpenseShares = pgTable(
	'shared_expense_shares',
	{
		bookingId: uuid('booking_id')
			.notNull()
			.references(() => sharedExpenses.bookingId, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		share: integer('share').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.bookingId, t.userId] }),
		index('shared_expense_shares_user_idx').on(t.userId),
		check('shared_expense_shares_range', sql`${t.share} between 0 and 10000`)
	]
);

/** A settlement between two users ("Ausgleich"): `fromUserId` paid `toUserId`. */
export const settlements = pgTable(
	'settlements',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		fromUserId: uuid('from_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		toUserId: uuid('to_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		date: date('date', { mode: 'string' }).notNull(),
		note: text('note'),
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		check('settlements_amount_positive', sql`${t.amount} > 0`),
		check('settlements_two_users', sql`${t.fromUserId} <> ${t.toUserId}`)
	]
);

export type Settlement = typeof settlements.$inferSelect;

/**
 * Monthly budget of a category ("Budget je Kategorie"): for one account (visible to its viewers)
 * or for all accounts of one user (`accountId` null, `ownerId` set).
 */
export const budgets = pgTable(
	'budgets',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
		accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
		ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		unique('budgets_scope').on(t.categoryId, t.accountId, t.ownerId).nullsNotDistinct(),
		check('budgets_amount_positive', sql`${t.amount} > 0`),
		check('budgets_scope_check', sql`(${t.accountId} is null) = (${t.ownerId} is not null)`)
	]
);

export type Budget = typeof budgets.$inferSelect;

/** "Was wäre wenn": a named scenario of one user for a giro account (changes nothing real). */
export const scenarios = pgTable('scenarios', {
	id: uuid('id').primaryKey().defaultRandom(),
	ownerId: uuid('owner_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	accountId: uuid('account_id')
		.notNull()
		.references(() => accounts.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * A change of a scenario: "add" a new item, "cancel" an item from a date on, or a new
 * "amount" from a date on. Amounts are positive cents.
 */
export const scenarioChanges = pgTable(
	'scenario_changes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		scenarioId: uuid('scenario_id')
			.notNull()
			.references(() => scenarios.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull(),
		recurringId: uuid('recurring_id').references(() => recurringItems.id, { onDelete: 'cascade' }),
		name: text('name'),
		direction: text('direction'),
		interval: text('interval'),
		amount: bigint('amount', { mode: 'number' }),
		date: date('date', { mode: 'string' }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('scenario_changes_scenario_idx').on(t.scenarioId),
		check('scenario_changes_kind', sql`${t.kind} in ('add', 'cancel', 'amount')`)
	]
);

export type ScenarioChange = typeof scenarioChanges.$inferSelect;
