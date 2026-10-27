ALTER TABLE "recipes" ADD COLUMN "is_meal_prep_friendly" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "image_flagged_for_regeneration" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "image_regeneration_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "image_regeneration_requested_by" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_chef_id_chefs_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."chefs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recipes_flagged_images" ON "recipes" USING btree ("image_flagged_for_regeneration");