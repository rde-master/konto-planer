CREATE TYPE "public"."import_status" AS ENUM('draft', 'done');--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid,
	"file_name" text NOT NULL,
	"status" "import_status" DEFAULT 'draft' NOT NULL,
	"encoding" text NOT NULL,
	"date_format" text NOT NULL,
	"number_format" text NOT NULL,
	"rows" jsonb,
	"new_count" integer DEFAULT 0 NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"adjustments_removed" integer DEFAULT 0 NOT NULL,
	"check_date" date,
	"bank_balance" bigint,
	"app_balance" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "bank_category" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "creditor_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "mandate_reference" text;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "imports_account_idx" ON "imports" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_import_idx" ON "bookings" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "bookings_checksum_idx" ON "bookings" USING btree ("account_id","checksum");