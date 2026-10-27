CREATE TABLE "hero_backgrounds" (
	"id" text PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slideshow_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"caption" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredient_statistics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"total_recipes" integer DEFAULT 0 NOT NULL,
	"public_recipes" integer DEFAULT 0 NOT NULL,
	"system_recipes" integer DEFAULT 0 NOT NULL,
	"popularity_score" integer DEFAULT 0 NOT NULL,
	"trending_score" integer DEFAULT 0 NOT NULL,
	"last_calculated" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_statistics_ingredient_id_unique" UNIQUE("ingredient_id")
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"category" varchar(50),
	"common_units" text,
	"aliases" text,
	"is_common" boolean DEFAULT false NOT NULL,
	"is_allergen" boolean DEFAULT false NOT NULL,
	"typical_unit" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ingredients_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"amount" varchar(50),
	"unit" varchar(50),
	"preparation" varchar(200),
	"is_optional" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"ingredient_group" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_ingredients_position_unique" UNIQUE("recipe_id","ingredient_id","position")
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
ALTER TABLE "ingredient_statistics" ADD CONSTRAINT "ingredient_statistics_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hero_backgrounds_display_order_idx" ON "hero_backgrounds" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "hero_backgrounds_is_active_idx" ON "hero_backgrounds" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "slideshow_photos_display_order_idx" ON "slideshow_photos" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "slideshow_photos_is_active_idx" ON "slideshow_photos" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ingredient_statistics_popularity_idx" ON "ingredient_statistics" USING btree ("popularity_score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ingredient_statistics_trending_idx" ON "ingredient_statistics" USING btree ("trending_score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ingredient_statistics_recipe_count_idx" ON "ingredient_statistics" USING btree ("total_recipes" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ingredients_name_idx" ON "ingredients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ingredients_name_lower_idx" ON "ingredients" USING btree (LOWER("name"));--> statement-breakpoint
CREATE INDEX "ingredients_display_name_idx" ON "ingredients" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "ingredients_category_idx" ON "ingredients" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ingredients_common_idx" ON "ingredients" USING btree ("is_common","name");--> statement-breakpoint
CREATE INDEX "ingredients_allergen_idx" ON "ingredients" USING btree ("is_allergen");--> statement-breakpoint
CREATE INDEX "ingredients_name_trgm_idx" ON "ingredients" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "ingredients_display_name_trgm_idx" ON "ingredients" USING gin ("display_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_ingredient_id_idx" ON "recipe_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_position_idx" ON "recipe_ingredients" USING btree ("recipe_id","position");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_optional_idx" ON "recipe_ingredients" USING btree ("recipe_id","is_optional");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_group_idx" ON "recipe_ingredients" USING btree ("recipe_id","ingredient_group");--> statement-breakpoint
CREATE INDEX "idx_recipes_slug" ON "recipes" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_slug_unique" UNIQUE("slug");