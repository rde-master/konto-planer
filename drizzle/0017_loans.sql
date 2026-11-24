CREATE TABLE "loan_extra_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loan_extra_payments_amount_positive" CHECK ("loan_extra_payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"recurring_id" uuid PRIMARY KEY NOT NULL,
	"principal" bigint NOT NULL,
	"rate" integer NOT NULL,
	"start_date" date NOT NULL,
	"term_end" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loans_principal_positive" CHECK ("loans"."principal" > 0),
	CONSTRAINT "loans_rate_range" CHECK ("loans"."rate" between 0 and 100000)
);
--> statement-breakpoint
ALTER TABLE "loan_extra_payments" ADD CONSTRAINT "loan_extra_payments_recurring_id_loans_recurring_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."loans"("recurring_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_recurring_id_recurring_items_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loan_extra_payments_loan_idx" ON "loan_extra_payments" USING btree ("recurring_id");