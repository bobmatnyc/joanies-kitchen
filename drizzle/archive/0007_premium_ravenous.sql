CREATE TABLE "chef_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chef_id" uuid NOT NULL,
	"recipe_id" text NOT NULL,
	"original_url" text,
	"scraped_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_chef_recipe" UNIQUE("chef_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE "chefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"bio" text,
	"profile_image_url" text,
	"website" text,
	"social_links" jsonb,
	"specialties" text[] DEFAULT '{}',
	"is_verified" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"recipe_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chefs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "scraping_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chef_id" uuid,
	"source_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"recipes_scraped" integer DEFAULT 0,
	"recipes_failed" integer DEFAULT 0,
	"total_pages" integer DEFAULT 0,
	"current_page" integer DEFAULT 0,
	"error" text,
	"metadata" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "chef_id" uuid;--> statement-breakpoint
ALTER TABLE "chef_recipes" ADD CONSTRAINT "chef_recipes_chef_id_chefs_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."chefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chef_recipes" ADD CONSTRAINT "chef_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraping_jobs" ADD CONSTRAINT "scraping_jobs_chef_id_chefs_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."chefs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chef_recipes_chef_id" ON "chef_recipes" USING btree ("chef_id");--> statement-breakpoint
CREATE INDEX "idx_chef_recipes_recipe_id" ON "chef_recipes" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_chefs_slug" ON "chefs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_chefs_active" ON "chefs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_chefs_recipe_count" ON "chefs" USING btree ("recipe_count" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_scraping_jobs_status" ON "scraping_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scraping_jobs_chef_id" ON "scraping_jobs" USING btree ("chef_id");--> statement-breakpoint
CREATE INDEX "idx_scraping_jobs_created_at" ON "scraping_jobs" USING btree ("created_at" DESC NULLS LAST);