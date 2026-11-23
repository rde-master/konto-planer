CREATE TYPE "public"."contract_renewal" AS ENUM('indefinite', 'period', 'none');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"default_lead_days" integer DEFAULT 30 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_single_row" CHECK ("app_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"recurring_id" uuid PRIMARY KEY NOT NULL,
	"term_end" date,
	"notice_every" integer NOT NULL,
	"notice_unit" "custom_unit" NOT NULL,
	"renewal" "contract_renewal" NOT NULL,
	"renewal_months" integer,
	"lead_days" integer,
	"cancelled_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_term_end_check" CHECK ("contracts"."term_end" is not null or "contracts"."renewal" = 'indefinite')
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_recurring_id_recurring_items_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_items"("id") ON DELETE cascade ON UPDATE no action;