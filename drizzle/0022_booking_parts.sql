CREATE TABLE "booking_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"category_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_parts_amount_not_zero" CHECK ("booking_parts"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "booking_parts" ADD CONSTRAINT "booking_parts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_parts" ADD CONSTRAINT "booking_parts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_parts_booking_idx" ON "booking_parts" USING btree ("booking_id");