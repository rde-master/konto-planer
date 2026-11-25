ALTER TYPE "public"."account_type" ADD VALUE 'kreditkarte';--> statement-breakpoint
ALTER TYPE "public"."booking_source" ADD VALUE 'settlement';--> statement-breakpoint
CREATE TABLE "card_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_account_id" uuid NOT NULL,
	"statement_date" date NOT NULL,
	"debit_date" date NOT NULL,
	"amount" bigint NOT NULL,
	"giro_booking_id" uuid,
	"card_booking_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "settlement_account_id" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "statement_day" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "debit_day" integer;--> statement-breakpoint
ALTER TABLE "card_settlements" ADD CONSTRAINT "card_settlements_card_account_id_accounts_id_fk" FOREIGN KEY ("card_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_settlements" ADD CONSTRAINT "card_settlements_giro_booking_id_bookings_id_fk" FOREIGN KEY ("giro_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_settlements" ADD CONSTRAINT "card_settlements_card_booking_id_bookings_id_fk" FOREIGN KEY ("card_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_settlements_card_statement_idx" ON "card_settlements" USING btree ("card_account_id","statement_date");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_settlement_account_id_accounts_id_fk" FOREIGN KEY ("settlement_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;