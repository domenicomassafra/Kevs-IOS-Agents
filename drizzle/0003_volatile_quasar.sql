CREATE TYPE "scheduler"."campaign_status" AS ENUM('draft', 'active', 'cancelled');--> statement-breakpoint
CREATE TABLE "scheduler"."campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "scheduler"."campaign_status" DEFAULT 'draft' NOT NULL,
	"task" jsonb NOT NULL,
	"timing" jsonb NOT NULL,
	"run_window_minutes" integer DEFAULT 30 NOT NULL,
	"targets" jsonb NOT NULL,
	"requires_fan_out_confirmation" integer DEFAULT 0 NOT NULL,
	"requires_public_action_confirmation" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"launched_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "scheduler"."pipeline_items" ALTER COLUMN "asset_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduler"."assets" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "scheduler"."executions" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "scheduler"."executions" ADD COLUMN "campaign_account" text;--> statement-breakpoint
ALTER TABLE "scheduler"."schedules" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "scheduler"."schedules" ADD COLUMN "campaign_account" text;--> statement-breakpoint
CREATE INDEX "campaigns_status_created_idx" ON "scheduler"."campaigns" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "scheduler"."assets" ADD CONSTRAINT "assets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "scheduler"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduler"."executions" ADD CONSTRAINT "executions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "scheduler"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduler"."schedules" ADD CONSTRAINT "schedules_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "scheduler"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_campaign_idx" ON "scheduler"."assets" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "executions_campaign_idx" ON "scheduler"."executions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "schedules_campaign_idx" ON "scheduler"."schedules" USING btree ("campaign_id");