CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlements_amount_positive" CHECK ("settlements"."amount" > 0),
	CONSTRAINT "settlements_two_users" CHECK ("settlements"."from_user_id" <> "settlements"."to_user_id")
);
--> statement-breakpoint
CREATE TABLE "shared_expense_shares" (
	"booking_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"share" integer NOT NULL,
	CONSTRAINT "shared_expense_shares_booking_id_user_id_pk" PRIMARY KEY("booking_id","user_id"),
	CONSTRAINT "shared_expense_shares_range" CHECK ("shared_expense_shares"."share" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "shared_expenses" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"payer_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_expense_shares" ADD CONSTRAINT "shared_expense_shares_booking_id_shared_expenses_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."shared_expenses"("booking_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_expense_shares" ADD CONSTRAINT "shared_expense_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_expenses" ADD CONSTRAINT "shared_expenses_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_expenses" ADD CONSTRAINT "shared_expenses_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_expenses" ADD CONSTRAINT "shared_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shared_expense_shares_user_idx" ON "shared_expense_shares" USING btree ("user_id");