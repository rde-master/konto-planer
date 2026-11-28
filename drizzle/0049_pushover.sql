ALTER TABLE "app_settings" ADD COLUMN "pushover_token_enc" text;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD COLUMN "pushover" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pushover_key_enc" text;