CREATE TYPE "public"."access_level" AS ENUM('view', 'edit');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('giro', 'sparbuch');--> statement-breakpoint
CREATE TABLE "account_access" (
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"level" "access_level" NOT NULL,
	CONSTRAINT "account_access_account_id_user_id_pk" PRIMARY KEY("account_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"iban" text,
	"opening_balance" bigint DEFAULT 0 NOT NULL,
	"opening_date" date NOT NULL,
	"overdraft_limit" bigint DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_iban_unique" UNIQUE("iban")
);
--> statement-breakpoint
ALTER TABLE "account_access" ADD CONSTRAINT "account_access_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_access" ADD CONSTRAINT "account_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_access_user_idx" ON "account_access" USING btree ("user_id");