CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"key" text NOT NULL,
	"user_id" uuid,
	"channel" text NOT NULL,
	"title" text NOT NULL,
	"ok" boolean NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"type" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"home_assistant" boolean DEFAULT false NOT NULL,
	"recipients" jsonb,
	"repeat" text DEFAULT 'once' NOT NULL,
	"tolerance_days" integer DEFAULT 3 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "smtp_host" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "smtp_port" integer;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "smtp_secure" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "smtp_user" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "smtp_password_enc" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "smtp_from" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ha_url" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "ha_token_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_targets" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_log_lookup_idx" ON "notification_log" USING btree ("type","key","user_id","channel");