CREATE TABLE "web_icons" (
	"id" text PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"source" text NOT NULL,
	"url" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payee_logos" ADD COLUMN "auto" boolean DEFAULT false NOT NULL;