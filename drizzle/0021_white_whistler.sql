CREATE TABLE "crawl_cost_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"units" numeric(14, 4) DEFAULT '0' NOT NULL,
	"usd" numeric(12, 6) NOT NULL,
	"estimated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawl_cost_events" ADD CONSTRAINT "crawl_cost_events_run_id_recipe_discovery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."recipe_discovery_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crawl_cost_events_created_at" ON "crawl_cost_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_crawl_cost_events_run_id" ON "crawl_cost_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_crawl_cost_events_provider" ON "crawl_cost_events" USING btree ("provider");