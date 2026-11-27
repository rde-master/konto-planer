ALTER TYPE "public"."rule_field" ADD VALUE 'booking_text';--> statement-breakpoint
ALTER TYPE "public"."rule_field" ADD VALUE 'bank_category';--> statement-breakpoint
ALTER TABLE "category_rules" ADD COLUMN "more_conditions" jsonb DEFAULT '[]'::jsonb NOT NULL;