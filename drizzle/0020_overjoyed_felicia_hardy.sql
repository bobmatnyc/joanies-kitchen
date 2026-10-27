CREATE TABLE "recipe_discovery_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_type" text DEFAULT 'daily' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"urls_discovered" integer DEFAULT 0,
	"recipes_extracted" integer DEFAULT 0,
	"recipes_stored" integer DEFAULT 0,
	"recipes_skipped" integer DEFAULT 0,
	"chefs_created" integer DEFAULT 0,
	"errors" jsonb DEFAULT '[]'::jsonb,
	"dry_run" boolean DEFAULT false,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "recipe_of_the_day" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" text,
	"date" date NOT NULL,
	"source_url" text,
	"scraped_at" timestamp DEFAULT now(),
	"theme" text DEFAULT 'no-waste',
	CONSTRAINT "recipe_of_the_day_date_unique" UNIQUE("date")
);
--> statement-breakpoint
ALTER TABLE "recipe_of_the_day" ADD CONSTRAINT "recipe_of_the_day_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recipe_discovery_runs_status" ON "recipe_discovery_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_recipe_discovery_runs_run_type" ON "recipe_discovery_runs" USING btree ("run_type");--> statement-breakpoint
CREATE INDEX "idx_recipe_discovery_runs_started_at" ON "recipe_discovery_runs" USING btree ("started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_recipe_of_the_day_date" ON "recipe_of_the_day" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_recipe_of_the_day_recipe_id" ON "recipe_of_the_day" USING btree ("recipe_id");