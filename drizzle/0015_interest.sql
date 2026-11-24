CREATE TYPE "public"."interest_rhythm" AS ENUM('monthly', 'quarterly', 'yearly');--> statement-breakpoint
ALTER TYPE "public"."booking_source" ADD VALUE 'interest';--> statement-breakpoint
CREATE TABLE "account_interest_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"rate" integer NOT NULL,
	"valid_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_interest_rates_range" CHECK ("account_interest_rates"."rate" between 0 and 100000)
);
--> statement-breakpoint
CREATE TABLE "interest_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"period_end" date NOT NULL,
	"amount" bigint NOT NULL,
	"amount_set" boolean DEFAULT false NOT NULL,
	"booking_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "interest_rhythm" "interest_rhythm" DEFAULT 'yearly' NOT NULL;--> statement-breakpoint
ALTER TABLE "account_interest_rates" ADD CONSTRAINT "account_interest_rates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_credits" ADD CONSTRAINT "interest_credits_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_credits" ADD CONSTRAINT "interest_credits_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_interest_rates_account_date_idx" ON "account_interest_rates" USING btree ("account_id","valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "interest_credits_account_period_idx" ON "interest_credits" USING btree ("account_id","period_end");