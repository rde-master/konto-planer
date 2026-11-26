CREATE TABLE "job_runs" (
	"job" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"message" text,
	"duration_ms" integer
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_version" text;--> statement-breakpoint
UPDATE "users" SET "last_seen_version" = '0.57.0';
