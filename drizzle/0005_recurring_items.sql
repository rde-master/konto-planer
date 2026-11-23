CREATE TYPE "public"."custom_unit" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('direct_debit', 'standing_order', 'manual');--> statement-breakpoint
CREATE TYPE "public"."recurring_interval" AS ENUM('weekly', 'monthly', 'quarterly', 'semiannual', 'yearly', 'custom', 'once');--> statement-breakpoint
CREATE TYPE "public"."recurring_kind" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TABLE "recurring_amounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"valid_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" "recurring_kind" NOT NULL,
	"name" text NOT NULL,
	"counterparty" text,
	"iban" text,
	"mandate_reference" text,
	"creditor_id" text,
	"category_id" uuid,
	"interval" "recurring_interval" NOT NULL,
	"custom_every" integer,
	"custom_unit" "custom_unit",
	"start_date" date NOT NULL,
	"end_date" date,
	"variable" boolean DEFAULT false NOT NULL,
	"is_salary" boolean DEFAULT false NOT NULL,
	"payment_method" "payment_method",
	"created_by" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_amounts" ADD CONSTRAINT "recurring_amounts_recurring_id_recurring_items_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_amounts_item_date_idx" ON "recurring_amounts" USING btree ("recurring_id","valid_from");--> statement-breakpoint
CREATE INDEX "recurring_items_account_idx" ON "recurring_items" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "recurring_items_category_idx" ON "recurring_items" USING btree ("category_id");