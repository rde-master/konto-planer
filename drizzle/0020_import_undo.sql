ALTER TABLE "imports" ADD COLUMN "undo" jsonb;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "undone_at" timestamp with time zone;