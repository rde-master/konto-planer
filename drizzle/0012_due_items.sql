CREATE TYPE "public"."due_status" AS ENUM('provisional', 'skipped', 'booked');--> statement-breakpoint
ALTER TYPE "public"."booking_source" ADD VALUE 'provisional';--> statement-breakpoint
CREATE TABLE "due_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"booking_date" date NOT NULL,
	"amount" bigint NOT NULL,
	"status" "due_status" DEFAULT 'provisional' NOT NULL,
	"moved" boolean DEFAULT false NOT NULL,
	"amount_set" boolean DEFAULT false NOT NULL,
	"booking_id" uuid,
	"target_booking_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "due_items_amount_positive" CHECK ("due_items"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "due_items" ADD CONSTRAINT "due_items_recurring_id_recurring_items_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_items" ADD CONSTRAINT "due_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_items" ADD CONSTRAINT "due_items_target_booking_id_bookings_id_fk" FOREIGN KEY ("target_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "due_items_recurring_date_idx" ON "due_items" USING btree ("recurring_id","due_date");--> statement-breakpoint
CREATE INDEX "due_items_booking_idx" ON "due_items" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "due_items_target_booking_idx" ON "due_items" USING btree ("target_booking_id");