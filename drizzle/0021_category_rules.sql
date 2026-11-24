CREATE TYPE "public"."rule_field" AS ENUM('counterparty', 'purpose', 'iban');--> statement-breakpoint
CREATE TYPE "public"."rule_operator" AS ENUM('contains', 'equals', 'starts_with');--> statement-breakpoint
CREATE TABLE "category_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field" "rule_field" NOT NULL,
	"operator" "rule_operator" NOT NULL,
	"value" text NOT NULL,
	"category_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_rules_position_idx" ON "category_rules" USING btree ("position");