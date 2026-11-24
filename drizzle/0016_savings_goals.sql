ALTER TYPE "public"."booking_source" ADD VALUE 'goal';--> statement-breakpoint
CREATE TABLE "goal_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid,
	"due_date" date NOT NULL,
	"booking_date" date NOT NULL,
	"amount" bigint NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"booking_id" uuid,
	"target_booking_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_transfers_status" CHECK ("goal_transfers"."status" in ('booked', 'skipped')),
	CONSTRAINT "goal_transfers_amount" CHECK ("goal_transfers"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "savings_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_amount" bigint NOT NULL,
	"target_date" date,
	"recurring_id" uuid,
	"allocated" bigint DEFAULT 0 NOT NULL,
	"since" date NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "savings_goals_account_name" UNIQUE("account_id","name"),
	CONSTRAINT "savings_goals_target_positive" CHECK ("savings_goals"."target_amount" > 0),
	CONSTRAINT "savings_goals_allocated_range" CHECK ("savings_goals"."allocated" >= 0)
);
--> statement-breakpoint
ALTER TABLE "goal_transfers" ADD CONSTRAINT "goal_transfers_goal_id_savings_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."savings_goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_transfers" ADD CONSTRAINT "goal_transfers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_transfers" ADD CONSTRAINT "goal_transfers_target_booking_id_bookings_id_fk" FOREIGN KEY ("target_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_recurring_id_recurring_items_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "goal_transfers_goal_date_idx" ON "goal_transfers" USING btree ("goal_id","due_date");--> statement-breakpoint
CREATE INDEX "goal_transfers_booking_idx" ON "goal_transfers" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "goal_transfers_target_booking_idx" ON "goal_transfers" USING btree ("target_booking_id");--> statement-breakpoint
CREATE INDEX "savings_goals_recurring_idx" ON "savings_goals" USING btree ("recurring_id");