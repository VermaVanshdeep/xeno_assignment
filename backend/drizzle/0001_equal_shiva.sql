CREATE TABLE "communication_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "audience_size" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "communication_jobs" ADD CONSTRAINT "communication_jobs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_jobs" ADD CONSTRAINT "communication_jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comm_jobs_campaign_id_idx" ON "communication_jobs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "comm_jobs_customer_id_idx" ON "communication_jobs" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "comm_jobs_status_idx" ON "communication_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "comm_jobs_composite_idx" ON "communication_jobs" USING btree ("campaign_id","customer_id");