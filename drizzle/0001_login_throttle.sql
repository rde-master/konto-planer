CREATE TABLE "login_throttle" (
	"username" text PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"last_failed_at" timestamp with time zone,
	"locked_until" timestamp with time zone
);
