CREATE TYPE "public"."cutoff_mode" AS ENUM('salary', 'month_end', 'date');--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "cutoff_mode" "cutoff_mode" DEFAULT 'salary' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "cutoff_recurring_id" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "cutoff_date" date;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_cutoff_recurring_id_recurring_items_id_fk" FOREIGN KEY ("cutoff_recurring_id") REFERENCES "public"."recurring_items"("id") ON DELETE set null ON UPDATE no action;