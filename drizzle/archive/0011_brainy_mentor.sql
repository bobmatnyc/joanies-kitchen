CREATE TABLE "meal_occasions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"tags" text,
	"is_holiday" boolean DEFAULT false,
	"season" text,
	"icon" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meal_occasions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "recipe_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"is_edited" boolean DEFAULT false NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_forks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text NOT NULL,
	"original_recipe_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_likes_recipe_id_user_id_unique" UNIQUE("recipe_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text NOT NULL,
	"task_name" text NOT NULL,
	"task_order" integer NOT NULL,
	"instruction_text" text NOT NULL,
	"task_type" text NOT NULL,
	"role" text NOT NULL,
	"active_time" integer NOT NULL,
	"passive_time" integer DEFAULT 0,
	"can_be_parallel" boolean DEFAULT true,
	"depends_on_task_ids" text,
	"ingredient_ids" text,
	"tool_ids" text,
	"parsed_by_model" text,
	"confidence_score" numeric(3, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text NOT NULL,
	"tool_id" uuid NOT NULL,
	"is_optional" boolean DEFAULT false,
	"quantity" integer DEFAULT 1,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"category" text NOT NULL,
	"is_essential" boolean DEFAULT false,
	"is_specialized" boolean DEFAULT false,
	"alternatives" text,
	"typical_price_usd" numeric(8, 2),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tools_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "chefs" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "chefs" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "chefs" ADD COLUMN "location_city" varchar(100);--> statement-breakpoint
ALTER TABLE "chefs" ADD COLUMN "location_state" varchar(50);--> statement-breakpoint
ALTER TABLE "chefs" ADD COLUMN "location_country" varchar(50);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "content_flagged_for_cleanup" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "ingredients_need_cleanup" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "instructions_need_cleanup" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "fork_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "collection_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "instruction_metadata" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "instruction_metadata_version" varchar(20);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "instruction_metadata_generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "instruction_metadata_model" varchar(100);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "weight_score" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "richness_score" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "acidity_score" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "sweetness_level" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "dominant_textures" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "dominant_flavors" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "serving_temperature" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "pairing_rationale" text;--> statement-breakpoint
ALTER TABLE "recipe_comments" ADD CONSTRAINT "recipe_comments_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_forks" ADD CONSTRAINT "recipe_forks_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_forks" ADD CONSTRAINT "recipe_forks_original_recipe_id_recipes_id_fk" FOREIGN KEY ("original_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_likes" ADD CONSTRAINT "recipe_likes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tasks" ADD CONSTRAINT "recipe_tasks_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tools" ADD CONSTRAINT "recipe_tools_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tools" ADD CONSTRAINT "recipe_tools_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_occasions_name_idx" ON "meal_occasions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "meal_occasions_season_idx" ON "meal_occasions" USING btree ("season");--> statement-breakpoint
CREATE INDEX "recipe_comments_recipe_id_idx" ON "recipe_comments" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_comments_user_id_idx" ON "recipe_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_comments_created_at_idx" ON "recipe_comments" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recipe_comments_is_flagged_idx" ON "recipe_comments" USING btree ("is_flagged");--> statement-breakpoint
CREATE INDEX "recipe_forks_recipe_id_idx" ON "recipe_forks" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_forks_original_recipe_id_idx" ON "recipe_forks" USING btree ("original_recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_forks_user_id_idx" ON "recipe_forks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_forks_created_at_idx" ON "recipe_forks" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recipe_likes_recipe_id_idx" ON "recipe_likes" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_likes_user_id_idx" ON "recipe_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_likes_created_at_idx" ON "recipe_likes" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recipe_tasks_recipe_id_idx" ON "recipe_tasks" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_tasks_task_order_idx" ON "recipe_tasks" USING btree ("recipe_id","task_order");--> statement-breakpoint
CREATE INDEX "recipe_tasks_task_type_idx" ON "recipe_tasks" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "recipe_tasks_role_idx" ON "recipe_tasks" USING btree ("role");--> statement-breakpoint
CREATE INDEX "recipe_tools_recipe_id_idx" ON "recipe_tools" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_tools_tool_id_idx" ON "recipe_tools" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tools_name_idx" ON "tools" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tools_category_idx" ON "tools" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tools_is_essential_idx" ON "tools" USING btree ("is_essential");--> statement-breakpoint
CREATE INDEX "idx_recipes_flagged_content" ON "recipes" USING btree ("content_flagged_for_cleanup");--> statement-breakpoint
CREATE INDEX "idx_recipes_deleted_at" ON "recipes" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_recipes_engagement" ON "recipes" USING btree ("like_count" DESC NULLS LAST,"fork_count" DESC NULLS LAST,"collection_count" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_recipes_instruction_metadata" ON "recipes" USING btree ("instruction_metadata");--> statement-breakpoint
CREATE INDEX "idx_recipes_pairing_metadata" ON "recipes" USING btree ("weight_score","richness_score","acidity_score");--> statement-breakpoint
CREATE INDEX "idx_recipes_serving_temp" ON "recipes" USING btree ("serving_temperature");