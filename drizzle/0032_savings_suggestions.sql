CREATE TABLE "savings_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"salary_due_date" date NOT NULL,
	"status" text NOT NULL,
	"amount" bigint,
	"target_account_id" uuid,
	"done_by" uuid,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "savings_suggestions_status" CHECK ("savings_suggestions"."status" in ('transferred', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "savings_suggestions" ADD CONSTRAINT "savings_suggestions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_suggestions" ADD CONSTRAINT "savings_suggestions_target_account_id_accounts_id_fk" FOREIGN KEY ("target_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_suggestions" ADD CONSTRAINT "savings_suggestions_done_by_users_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "savings_suggestions_account_salary_idx" ON "savings_suggestions" USING btree ("account_id","salary_due_date");