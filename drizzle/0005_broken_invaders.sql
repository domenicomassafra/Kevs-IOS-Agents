CREATE TABLE "scheduler"."device_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"selector" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "device_pools_name_idx" ON "scheduler"."device_pools" USING btree ("name");--> statement-breakpoint
CREATE INDEX "device_pools_updated_idx" ON "scheduler"."device_pools" USING btree ("updated_at");