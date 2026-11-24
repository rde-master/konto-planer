CREATE TABLE "booking_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint,
	"account_id" uuid,
	"category_id" uuid,
	"counterparty" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_templates_owner_name" UNIQUE NULLS NOT DISTINCT("owner_id","name"),
	CONSTRAINT "booking_templates_kind" CHECK ("booking_templates"."kind" in ('expense', 'income')),
	CONSTRAINT "booking_templates_amount_positive" CHECK ("booking_templates"."amount" is null or "booking_templates"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "booking_templates" ADD CONSTRAINT "booking_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_templates" ADD CONSTRAINT "booking_templates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_templates" ADD CONSTRAINT "booking_templates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_templates" ADD CONSTRAINT "booking_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;