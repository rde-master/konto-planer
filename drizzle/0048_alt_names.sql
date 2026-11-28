ALTER TABLE "recurring_items" ADD COLUMN "alt_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "alt_names" boolean DEFAULT true NOT NULL;