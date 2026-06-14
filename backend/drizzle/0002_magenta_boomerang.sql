ALTER TABLE "communication_jobs" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "communication_jobs" ADD COLUMN "last_error" text;