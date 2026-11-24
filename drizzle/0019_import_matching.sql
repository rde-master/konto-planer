CREATE TABLE "counterparty_categories" (
	"key" text PRIMARY KEY NOT NULL,
	"category_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "counter_booking_id" uuid;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "period_from" date;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "period_to" date;--> statement-breakpoint
ALTER TABLE "counterparty_categories" ADD CONSTRAINT "counterparty_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_counter_booking_id_bookings_id_fk" FOREIGN KEY ("counter_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;