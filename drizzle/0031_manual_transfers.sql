CREATE TABLE "manual_transfers_done" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"done_by" uuid,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_rules" ADD COLUMN "lead_days" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "manual_transfers_done" ADD CONSTRAINT "manual_transfers_done_recurring_id_recurring_items_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_transfers_done" ADD CONSTRAINT "manual_transfers_done_done_by_users_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manual_transfers_done_item_date_idx" ON "manual_transfers_done" USING btree ("recurring_id","due_date");