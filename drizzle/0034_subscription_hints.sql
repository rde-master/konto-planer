CREATE TABLE "subscription_hints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"iban" text,
	"amount" bigint NOT NULL,
	"interval" text NOT NULL,
	"last_date" date NOT NULL,
	"count" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"recurring_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_hints_status" CHECK ("subscription_hints"."status" in ('open', 'dismissed', 'created'))
);
--> statement-breakpoint
ALTER TABLE "subscription_hints" ADD CONSTRAINT "subscription_hints_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_hints" ADD CONSTRAINT "subscription_hints_recurring_id_recurring_items_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_hints_account_key_idx" ON "subscription_hints" USING btree ("account_id","key");