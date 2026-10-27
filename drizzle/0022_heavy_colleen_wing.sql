CREATE TABLE "recipe_discovery_run_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"url" text NOT NULL,
	"source_domain" text,
	"extraction_tier" text DEFAULT 'none' NOT NULL,
	"outcome" text NOT NULL,
	"error" text,
	"recipe_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_discovery_runs" ADD COLUMN "cost_usd" numeric(12, 6);--> statement-breakpoint
ALTER TABLE "recipe_discovery_runs" ADD COLUMN "budget_usd" numeric(12, 6);--> statement-breakpoint
ALTER TABLE "recipe_discovery_runs" ADD COLUMN "cost_write_failures" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "recipe_discovery_run_items" ADD CONSTRAINT "recipe_discovery_run_items_run_id_recipe_discovery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."recipe_discovery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recipe_discovery_run_items_run_id" ON "recipe_discovery_run_items" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_discovery_run_items_outcome" ON "recipe_discovery_run_items" USING btree ("outcome");