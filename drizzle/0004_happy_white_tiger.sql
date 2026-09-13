CREATE TABLE "scheduler"."flow_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduler"."flow_versions" (
	"flow_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_versions_flow_id_version_pk" PRIMARY KEY("flow_id","version")
);
--> statement-breakpoint
ALTER TABLE "scheduler"."flow_versions" ADD CONSTRAINT "flow_versions_flow_id_flow_definitions_id_fk" FOREIGN KEY ("flow_id") REFERENCES "scheduler"."flow_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flow_definitions_updated_idx" ON "scheduler"."flow_definitions" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "flow_versions_flow_created_idx" ON "scheduler"."flow_versions" USING btree ("flow_id","created_at");