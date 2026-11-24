CREATE TYPE "public"."booking_source" AS ENUM('manual', 'import', 'adjustment');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"booking_date" date NOT NULL,
	"value_date" date,
	"amount" bigint NOT NULL,
	"counterparty" text,
	"iban" text,
	"purpose" text,
	"booking_text" text,
	"category_id" uuid,
	"source" "booking_source" NOT NULL,
	"balance_after" bigint,
	"checksum" text,
	"recurring_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_amount_not_zero" CHECK ("bookings"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_recurring_id_recurring_items_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_account_date_idx" ON "bookings" USING btree ("account_id","booking_date");--> statement-breakpoint
CREATE INDEX "bookings_category_idx" ON "bookings" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "bookings_recurring_idx" ON "bookings" USING btree ("recurring_id");