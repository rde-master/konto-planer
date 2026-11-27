CREATE TABLE "payee_group_members" (
	"key" text PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payee_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payee_group_members" ADD CONSTRAINT "payee_group_members_group_id_payee_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."payee_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payee_groups" ADD CONSTRAINT "payee_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payee_group_members_group_idx" ON "payee_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payee_groups_name_idx" ON "payee_groups" USING btree (lower("name"));