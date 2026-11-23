CREATE TABLE "recurring_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "cancel_name" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "cancel_street" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "cancel_postal_code" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "cancel_city" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "cancel_email" text;--> statement-breakpoint
ALTER TABLE "recurring_items" ADD COLUMN "customer_number" text;--> statement-breakpoint
ALTER TABLE "recurring_items" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "recurring_attachments" ADD CONSTRAINT "recurring_attachments_recurring_id_recurring_items_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_attachments" ADD CONSTRAINT "recurring_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_attachments_item_idx" ON "recurring_attachments" USING btree ("recurring_id");