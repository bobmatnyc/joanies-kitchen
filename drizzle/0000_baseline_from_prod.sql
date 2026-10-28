-- #9 / #7: baseline generated from the code schema after it was aligned with
-- prod (owner ruling D7a: prod is the source of truth). Prod already has this
-- schema; record it there with drizzle/baseline-mark-applied.sql, never by
-- running this file. History 0000-0023 lives in drizzle/archive/.
-- Prod extensions (not emitted by drizzle-kit): vector 0.8.0, pg_trgm 1.6.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."inventory_status" AS ENUM('fresh', 'use_soon', 'expiring', 'expired', 'used', 'wasted');--> statement-breakpoint
CREATE TYPE "public"."recipe_license" AS ENUM('PUBLIC_DOMAIN', 'CC_BY', 'CC_BY_SA', 'CC_BY_NC', 'CC_BY_NC_SA', 'EDUCATIONAL_USE', 'PERSONAL_USE', 'ALL_RIGHTS_RESERVED', 'FAIR_USE');--> statement-breakpoint
CREATE TYPE "public"."storage_location" AS ENUM('fridge', 'freezer', 'pantry', 'other');--> statement-breakpoint
CREATE TYPE "public"."usage_action" AS ENUM('cooked', 'eaten_raw', 'composted', 'trashed', 'donated');--> statement-breakpoint
CREATE TYPE "public"."waste_outcome" AS ENUM('expired', 'spoiled', 'forgot_about_it', 'bought_too_much', 'overcooked', 'other');--> statement-breakpoint
CREATE TABLE "chefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"source_id" uuid,
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
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"location_city" varchar(100),
	"location_state" varchar(50),
	"location_country" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chefs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "hero_backgrounds" (
	"id" text PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
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
	"slug" varchar(255),
	"category" varchar(50),
	"type" varchar(50),
	"subtype" varchar(100),
	"is_purchaseable" boolean DEFAULT true NOT NULL,
	"common_units" text,
	"aliases" text,
	"description" text,
	"storage_tips" text,
	"substitutions" text,
	"image_url" text,
	"is_suitable_for_image" boolean DEFAULT true,
	"is_common" boolean DEFAULT false NOT NULL,
	"is_allergen" boolean DEFAULT false NOT NULL,
	"typical_unit" varchar(20),
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ingredients_name_unique" UNIQUE("name"),
	CONSTRAINT "ingredients_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"storage_location" "storage_location" NOT NULL,
	"status" "inventory_status" DEFAULT 'fresh' NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"acquisition_date" timestamp DEFAULT now() NOT NULL,
	"expiry_date" timestamp,
	"cost_usd" numeric(8, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_usage_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"recipe_id" text,
	"action" "usage_action" NOT NULL,
	"quantity_used" numeric(10, 2) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"notes" text,
	"used_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "joanie_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text,
	"meal_id" uuid,
	"ingredient_id" uuid,
	"comment_text" text NOT NULL,
	"comment_type" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "joanie_comments_comment_type_check" CHECK (comment_type = ANY (ARRAY['story'::text, 'tip'::text, 'substitution'::text, 'general'::text])),
	CONSTRAINT "joanie_comments_single_reference_check" CHECK (((recipe_id IS NOT NULL) AND (meal_id IS NULL) AND (ingredient_id IS NULL)) OR ((meal_id IS NOT NULL) AND (recipe_id IS NULL) AND (ingredient_id IS NULL)) OR ((ingredient_id IS NOT NULL) AND (recipe_id IS NULL) AND (meal_id IS NULL)))
);
--> statement-breakpoint
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
CREATE TABLE "meal_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"recipe_id" text NOT NULL,
	"course_category" text DEFAULT 'main' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"serving_multiplier" numeric(4, 2) DEFAULT '1.00' NOT NULL,
	"preparation_notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "meal_recipes_meal_id_recipe_id_unique" UNIQUE("meal_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE "meal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"meal_type" text,
	"occasion" text,
	"template_structure" text NOT NULL,
	"default_serves" integer DEFAULT 4 NOT NULL,
	"is_system" boolean DEFAULT false,
	"created_by" text,
	"times_used" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"meal_type" text,
	"occasion" text,
	"serves" integer DEFAULT 4 NOT NULL,
	"tags" text,
	"estimated_total_cost" numeric(10, 2),
	"estimated_cost_per_serving" numeric(10, 2),
	"price_estimation_date" timestamp,
	"price_estimation_confidence" numeric(3, 2),
	"is_template" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"total_prep_time" integer,
	"total_cook_time" integer,
	"image_url" text,
	"slug" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "meals_slug_unique" UNIQUE("slug")
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
CREATE TABLE "recipe_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text NOT NULL,
	"embedding" vector(384) NOT NULL,
	"embedding_text" text NOT NULL,
	"model_name" varchar(100) DEFAULT 'all-MiniLM-L6-v2' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
	-- #9: recipe_embeddings_recipe_id_unique is declared in code (and in the
	-- snapshot) but absent from prod; it is pending an owner ruling, so this
	-- baseline omits it.
);
--> statement-breakpoint
CREATE TABLE "recipe_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "recipe_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_likes_recipe_id_user_id_unique" UNIQUE("recipe_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "recipe_ratings_recipe_id_user_id_unique" UNIQUE("recipe_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_source_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_source_type" UNIQUE("source_id","name")
);
--> statement-breakpoint
CREATE TABLE "recipe_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"website_url" text,
	"logo_url" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_sources_name_unique" UNIQUE("name"),
	CONSTRAINT "recipe_sources_slug_unique" UNIQUE("slug")
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
CREATE TABLE "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chef_id" uuid,
	"source_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"ingredients" text NOT NULL,
	"instructions" text NOT NULL,
	"prep_time" integer,
	"cook_time" integer,
	"servings" integer,
	"difficulty" text,
	"cuisine" text,
	"tags" text,
	"image_url" text,
	"images" text,
	"is_ai_generated" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"is_system_recipe" boolean DEFAULT false,
	"is_meal_prep_friendly" boolean DEFAULT false,
	"nutrition_info" text,
	"model_used" text,
	"source" text,
	"license" "recipe_license" DEFAULT 'ALL_RIGHTS_RESERVED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"search_query" text,
	"discovery_date" timestamp with time zone,
	"confidence_score" numeric(3, 2),
	"validation_model" text,
	"embedding_model" text,
	"discovery_week" integer,
	"discovery_year" integer,
	"published_date" timestamp,
	"system_rating" numeric(2, 1),
	"system_rating_reason" text,
	"avg_user_rating" numeric(2, 1),
	"total_user_ratings" integer DEFAULT 0,
	"slug" varchar(255),
	"video_url" text,
	"image_flagged_for_regeneration" boolean DEFAULT false,
	"image_regeneration_requested_at" timestamp,
	"image_regeneration_requested_by" text,
	"content_flagged_for_cleanup" boolean DEFAULT false,
	"ingredients_need_cleanup" boolean DEFAULT false,
	"instructions_need_cleanup" boolean DEFAULT false,
	"deleted_at" timestamp,
	"deleted_by" text,
	"like_count" integer DEFAULT 0 NOT NULL,
	"fork_count" integer DEFAULT 0 NOT NULL,
	"collection_count" integer DEFAULT 0 NOT NULL,
	"instruction_metadata" text,
	"instruction_metadata_version" varchar(20),
	"instruction_metadata_generated_at" timestamp,
	"instruction_metadata_model" varchar(100),
	"weight_score" integer,
	"richness_score" integer,
	"acidity_score" integer,
	"sweetness_level" text,
	"dominant_textures" text,
	"dominant_flavors" text,
	"serving_temperature" text,
	"pairing_rationale" text,
	"resourcefulness_score" integer,
	"waste_reduction_tags" text,
	"scrap_utilization_notes" text,
	"environmental_notes" text,
	"qa_status" varchar(50) DEFAULT 'pending',
	"qa_timestamp" timestamp,
	"qa_method" varchar(100),
	"qa_confidence" numeric(3, 2),
	"qa_notes" text,
	"qa_issues_found" text,
	"qa_fixes_applied" text,
	"last_cleaned_at" timestamp,
	"last_cleaned_model" text,
	"moderation_status" text DEFAULT 'pending' NOT NULL,
	"moderation_notes" text,
	"moderated_by" text,
	"moderated_at" timestamp,
	"submission_notes" text,
	CONSTRAINT "recipes_slug_unique" UNIQUE("slug"),
	CONSTRAINT "recipes_moderation_status_check" CHECK (moderation_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'flagged'::text]))
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"meal_id" uuid,
	"name" text NOT NULL,
	"notes" text,
	"items" text NOT NULL,
	"estimated_total_cost" numeric(10, 2),
	"estimated_cost_breakdown" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
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
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"category" text NOT NULL,
	"type" varchar(50),
	"subtype" varchar(100),
	"is_essential" boolean DEFAULT false,
	"is_specialized" boolean DEFAULT false,
	"alternatives" text,
	"typical_price_usd" numeric(8, 2),
	"description" text,
	"image_url" text,
	"slug" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tools_name_unique" UNIQUE("name"),
	CONSTRAINT "tools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "waste_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"inventory_item_id" uuid,
	"outcome" "waste_outcome" NOT NULL,
	"cost_usd" numeric(8, 2),
	"weight_oz" numeric(10, 2),
	"days_owned" integer,
	"could_have_been_used_in" text,
	"notes" text,
	"wasted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"recipe_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"personal_note" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_recipes_unique" UNIQUE("collection_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"cover_image_url" text,
	"recipe_count" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_recipe_added_at" timestamp,
	CONSTRAINT "collections_user_slug_unique" UNIQUE("user_id","slug")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_unique" UNIQUE("user_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"recipe_id" text NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"username" varchar(30) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"bio" text,
	"profile_image_url" text,
	"location" varchar(100),
	"website" text,
	"specialties" json,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
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
	"duration_ms" integer,
	"cost_usd" numeric(12, 6),
	"budget_usd" numeric(12, 6),
	"cost_write_failures" integer DEFAULT 0
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
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "api_key_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(10) NOT NULL,
	"status_code" integer NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"response_time_ms" integer,
	"request_size_bytes" integer,
	"response_size_bytes" integer,
	"error_message" text,
	"error_code" varchar(50),
	"metadata" jsonb,
	"requested_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"description" text,
	"environment" varchar(20) DEFAULT 'production',
	"total_requests" integer DEFAULT 0 NOT NULL,
	"last_ip_address" varchar(45),
	"created_by" text,
	"revoked_at" timestamp,
	"revoked_by" text,
	"revocation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_key" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "chefs" ADD CONSTRAINT "chefs_source_id_recipe_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."recipe_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_statistics" ADD CONSTRAINT "ingredient_statistics_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_usage_log" ADD CONSTRAINT "inventory_usage_log_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_usage_log" ADD CONSTRAINT "inventory_usage_log_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joanie_comments" ADD CONSTRAINT "joanie_comments_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joanie_comments" ADD CONSTRAINT "joanie_comments_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joanie_comments" ADD CONSTRAINT "joanie_comments_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_recipes" ADD CONSTRAINT "meal_recipes_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_recipes" ADD CONSTRAINT "meal_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_comments" ADD CONSTRAINT "recipe_comments_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_embeddings" ADD CONSTRAINT "recipe_embeddings_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_flags" ADD CONSTRAINT "recipe_flags_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_forks" ADD CONSTRAINT "recipe_forks_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_forks" ADD CONSTRAINT "recipe_forks_original_recipe_id_recipes_id_fk" FOREIGN KEY ("original_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_likes" ADD CONSTRAINT "recipe_likes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ratings" ADD CONSTRAINT "recipe_ratings_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_source_types" ADD CONSTRAINT "recipe_source_types_source_id_recipe_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."recipe_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tasks" ADD CONSTRAINT "recipe_tasks_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tools" ADD CONSTRAINT "recipe_tools_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tools" ADD CONSTRAINT "recipe_tools_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_chef_id_chefs_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."chefs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_source_id_recipe_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."recipe_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_tracking" ADD CONSTRAINT "waste_tracking_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_tracking" ADD CONSTRAINT "waste_tracking_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_recipes" ADD CONSTRAINT "collection_recipes_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_recipes" ADD CONSTRAINT "collection_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_views" ADD CONSTRAINT "recipe_views_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_views" ADD CONSTRAINT "recipe_views_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chef_recipes" ADD CONSTRAINT "chef_recipes_chef_id_chefs_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."chefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chef_recipes" ADD CONSTRAINT "chef_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraping_jobs" ADD CONSTRAINT "scraping_jobs_chef_id_chefs_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."chefs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_cost_events" ADD CONSTRAINT "crawl_cost_events_run_id_recipe_discovery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."recipe_discovery_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_discovery_run_items" ADD CONSTRAINT "recipe_discovery_run_items_run_id_recipe_discovery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."recipe_discovery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_of_the_day" ADD CONSTRAINT "recipe_of_the_day_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_usage" ADD CONSTRAINT "api_key_usage_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chefs_slug" ON "chefs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_chefs_active" ON "chefs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_chefs_recipe_count" ON "chefs" USING btree ("recipe_count" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "hero_backgrounds_display_order_idx" ON "hero_backgrounds" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "hero_backgrounds_is_active_idx" ON "hero_backgrounds" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ingredient_statistics_popularity_idx" ON "ingredient_statistics" USING btree ("popularity_score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ingredient_statistics_trending_idx" ON "ingredient_statistics" USING btree ("trending_score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ingredient_statistics_recipe_count_idx" ON "ingredient_statistics" USING btree ("total_recipes" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ingredients_name_idx" ON "ingredients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ingredients_name_lower_idx" ON "ingredients" USING btree (lower(name));--> statement-breakpoint
CREATE INDEX "ingredients_display_name_idx" ON "ingredients" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "ingredients_slug_idx" ON "ingredients" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ingredients_category_idx" ON "ingredients" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ingredients_type_idx" ON "ingredients" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ingredients_subtype_idx" ON "ingredients" USING btree ("subtype");--> statement-breakpoint
CREATE INDEX "ingredients_type_subtype_idx" ON "ingredients" USING btree ("type","subtype");--> statement-breakpoint
CREATE INDEX "ingredients_common_idx" ON "ingredients" USING btree ("is_common","name");--> statement-breakpoint
CREATE INDEX "ingredients_allergen_idx" ON "ingredients" USING btree ("is_allergen");--> statement-breakpoint
CREATE INDEX "ingredients_name_trgm_idx" ON "ingredients" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "ingredients_display_name_trgm_idx" ON "ingredients" USING gin ("display_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ingredients_aliases_gin" ON "ingredients" USING gin ("aliases" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ingredients_category" ON "ingredients" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_ingredients_is_common" ON "ingredients" USING btree ("is_common");--> statement-breakpoint
CREATE INDEX "idx_ingredients_name" ON "ingredients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "inventory_items_user_id_idx" ON "inventory_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "inventory_items_ingredient_id_idx" ON "inventory_items" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "inventory_items_status_idx" ON "inventory_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "inventory_items_expiry_date_idx" ON "inventory_items" USING btree ("user_id","expiry_date");--> statement-breakpoint
CREATE INDEX "inventory_items_storage_location_idx" ON "inventory_items" USING btree ("user_id","storage_location");--> statement-breakpoint
CREATE INDEX "inventory_items_user_status_expiry_idx" ON "inventory_items" USING btree ("user_id","status","expiry_date");--> statement-breakpoint
CREATE INDEX "inventory_usage_log_inventory_item_id_idx" ON "inventory_usage_log" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "inventory_usage_log_recipe_id_idx" ON "inventory_usage_log" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "inventory_usage_log_action_idx" ON "inventory_usage_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "inventory_usage_log_used_at_idx" ON "inventory_usage_log" USING btree ("used_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "joanie_comments_recipe_id_idx" ON "joanie_comments" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "joanie_comments_meal_id_idx" ON "joanie_comments" USING btree ("meal_id");--> statement-breakpoint
CREATE INDEX "joanie_comments_ingredient_id_idx" ON "joanie_comments" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "joanie_comments_type_idx" ON "joanie_comments" USING btree ("comment_type");--> statement-breakpoint
CREATE INDEX "joanie_comments_created_at_idx" ON "joanie_comments" USING btree ("created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "meal_occasions_name_idx" ON "meal_occasions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "meal_occasions_season_idx" ON "meal_occasions" USING btree ("season");--> statement-breakpoint
CREATE INDEX "meal_recipes_meal_id_idx" ON "meal_recipes" USING btree ("meal_id");--> statement-breakpoint
CREATE INDEX "meal_recipes_recipe_id_idx" ON "meal_recipes" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "meal_recipes_display_order_idx" ON "meal_recipes" USING btree ("meal_id","display_order");--> statement-breakpoint
CREATE INDEX "meal_templates_meal_type_idx" ON "meal_templates" USING btree ("meal_type");--> statement-breakpoint
CREATE INDEX "meal_templates_is_system_idx" ON "meal_templates" USING btree ("is_system");--> statement-breakpoint
CREATE INDEX "meal_templates_times_used_idx" ON "meal_templates" USING btree ("times_used" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "meals_user_id_idx" ON "meals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meals_meal_type_idx" ON "meals" USING btree ("meal_type");--> statement-breakpoint
CREATE INDEX "meals_is_template_idx" ON "meals" USING btree ("is_template");--> statement-breakpoint
CREATE INDEX "meals_is_public_idx" ON "meals" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "meals_created_at_idx" ON "meals" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "meals_slug_idx" ON "meals" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "recipe_comments_recipe_id_idx" ON "recipe_comments" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_comments_user_id_idx" ON "recipe_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_comments_created_at_idx" ON "recipe_comments" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recipe_comments_is_flagged_idx" ON "recipe_comments" USING btree ("is_flagged");--> statement-breakpoint
CREATE INDEX "recipe_flags_recipe_id_idx" ON "recipe_flags" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_flags_status_idx" ON "recipe_flags" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recipe_flags_user_id_idx" ON "recipe_flags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_flags_created_at_idx" ON "recipe_flags" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recipe_forks_recipe_id_idx" ON "recipe_forks" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_forks_original_recipe_id_idx" ON "recipe_forks" USING btree ("original_recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_forks_user_id_idx" ON "recipe_forks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_forks_created_at_idx" ON "recipe_forks" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_ingredient_id_idx" ON "recipe_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_position_idx" ON "recipe_ingredients" USING btree ("recipe_id","position");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_optional_idx" ON "recipe_ingredients" USING btree ("recipe_id","is_optional");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_group_idx" ON "recipe_ingredients" USING btree ("recipe_id","ingredient_group");--> statement-breakpoint
CREATE INDEX "idx_recipe_ingredients_ingredient" ON "recipe_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_ingredients_recipe" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_likes_recipe_id_idx" ON "recipe_likes" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_likes_user_id_idx" ON "recipe_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_likes_created_at_idx" ON "recipe_likes" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recipe_ratings_recipe_id_idx" ON "recipe_ratings" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_ratings_user_id_idx" ON "recipe_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_source_types_source_id_idx" ON "recipe_source_types" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "recipe_sources_slug_idx" ON "recipe_sources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "recipe_sources_is_active_idx" ON "recipe_sources" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "recipe_tasks_recipe_id_idx" ON "recipe_tasks" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_tasks_task_order_idx" ON "recipe_tasks" USING btree ("recipe_id","task_order");--> statement-breakpoint
CREATE INDEX "recipe_tasks_task_type_idx" ON "recipe_tasks" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "recipe_tasks_role_idx" ON "recipe_tasks" USING btree ("role");--> statement-breakpoint
CREATE INDEX "recipe_tools_recipe_id_idx" ON "recipe_tools" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_tools_tool_id_idx" ON "recipe_tools" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "idx_recipes_rating" ON "recipes" USING btree ("system_rating" DESC NULLS LAST,"avg_user_rating" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_recipes_created" ON "recipes" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_recipes_user_public" ON "recipes" USING btree ("user_id","is_public");--> statement-breakpoint
CREATE INDEX "idx_recipes_system" ON "recipes" USING btree ("is_system_recipe");--> statement-breakpoint
CREATE INDEX "idx_recipes_cuisine" ON "recipes" USING btree ("cuisine");--> statement-breakpoint
CREATE INDEX "idx_recipes_difficulty" ON "recipes" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "idx_recipes_public_system" ON "recipes" USING btree ("is_public","is_system_recipe");--> statement-breakpoint
CREATE INDEX "idx_recipes_discovery_week" ON "recipes" USING btree ("discovery_year","discovery_week");--> statement-breakpoint
CREATE INDEX "idx_recipes_slug" ON "recipes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_recipes_flagged_images" ON "recipes" USING btree ("image_flagged_for_regeneration") WHERE (image_flagged_for_regeneration = true);--> statement-breakpoint
CREATE INDEX "idx_recipes_flagged_content" ON "recipes" USING btree ("content_flagged_for_cleanup");--> statement-breakpoint
CREATE INDEX "idx_recipes_deleted_at" ON "recipes" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_recipes_engagement" ON "recipes" USING btree ("like_count" DESC NULLS LAST,"fork_count" DESC NULLS LAST,"collection_count" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_recipes_instruction_metadata" ON "recipes" USING btree ("instruction_metadata");--> statement-breakpoint
CREATE INDEX "idx_recipes_pairing_metadata" ON "recipes" USING btree ("weight_score","richness_score","acidity_score");--> statement-breakpoint
CREATE INDEX "idx_recipes_serving_temp" ON "recipes" USING btree ("serving_temperature");--> statement-breakpoint
CREATE INDEX "idx_recipes_license" ON "recipes" USING btree ("license");--> statement-breakpoint
CREATE INDEX "idx_recipes_qa_status" ON "recipes" USING btree ("qa_status");--> statement-breakpoint
CREATE INDEX "idx_recipes_qa_timestamp" ON "recipes" USING btree ("qa_timestamp");--> statement-breakpoint
CREATE INDEX "idx_recipes_qa_method" ON "recipes" USING btree ("qa_method");--> statement-breakpoint
CREATE INDEX "idx_recipes_moderation_status" ON "recipes" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "idx_recipes_moderation_pending" ON "recipes" USING btree ("moderation_status","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "shopping_lists_user_id_idx" ON "shopping_lists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shopping_lists_meal_id_idx" ON "shopping_lists" USING btree ("meal_id");--> statement-breakpoint
CREATE INDEX "shopping_lists_status_idx" ON "shopping_lists" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shopping_lists_created_at_idx" ON "shopping_lists" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "slideshow_photos_display_order_idx" ON "slideshow_photos" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "slideshow_photos_is_active_idx" ON "slideshow_photos" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "tools_name_idx" ON "tools" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tools_category_idx" ON "tools" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tools_is_essential_idx" ON "tools" USING btree ("is_essential");--> statement-breakpoint
CREATE INDEX "tools_type_idx" ON "tools" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tools_subtype_idx" ON "tools" USING btree ("subtype");--> statement-breakpoint
CREATE INDEX "tools_type_subtype_idx" ON "tools" USING btree ("type","subtype");--> statement-breakpoint
CREATE INDEX "tools_slug_idx" ON "tools" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "waste_tracking_user_id_idx" ON "waste_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "waste_tracking_ingredient_id_idx" ON "waste_tracking" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "waste_tracking_outcome_idx" ON "waste_tracking" USING btree ("user_id","outcome");--> statement-breakpoint
CREATE INDEX "waste_tracking_wasted_at_idx" ON "waste_tracking" USING btree ("user_id","wasted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "waste_tracking_inventory_item_id_idx" ON "waste_tracking" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "waste_tracking_cost_idx" ON "waste_tracking" USING btree ("user_id","cost_usd" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "collection_recipes_collection_id_idx" ON "collection_recipes" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "collection_recipes_recipe_id_idx" ON "collection_recipes" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "collection_recipes_position_idx" ON "collection_recipes" USING btree ("collection_id","position");--> statement-breakpoint
CREATE INDEX "collections_user_id_idx" ON "collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collections_public_idx" ON "collections" USING btree ("is_public","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "collections_slug_idx" ON "collections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "favorites_user_id_idx" ON "favorites" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "favorites_recipe_id_idx" ON "favorites" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_views_user_id_viewed_at_idx" ON "recipe_views" USING btree ("user_id","viewed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recipe_views_recipe_id_idx" ON "recipe_views" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_views_viewed_at_idx" ON "recipe_views" USING btree ("viewed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_username_lower_idx" ON "user_profiles" USING btree (lower((username)::text));--> statement-breakpoint
CREATE INDEX "user_profiles_public_idx" ON "user_profiles" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "idx_chef_recipes_chef_id" ON "chef_recipes" USING btree ("chef_id");--> statement-breakpoint
CREATE INDEX "idx_chef_recipes_recipe_id" ON "chef_recipes" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_scraping_jobs_status" ON "scraping_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scraping_jobs_chef_id" ON "scraping_jobs" USING btree ("chef_id");--> statement-breakpoint
CREATE INDEX "idx_scraping_jobs_created_at" ON "scraping_jobs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_crawl_cost_events_created_at" ON "crawl_cost_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_crawl_cost_events_run_id" ON "crawl_cost_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_crawl_cost_events_provider" ON "crawl_cost_events" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_recipe_discovery_run_items_run_id" ON "recipe_discovery_run_items" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_discovery_run_items_outcome" ON "recipe_discovery_run_items" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "idx_recipe_discovery_runs_status" ON "recipe_discovery_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_recipe_discovery_runs_run_type" ON "recipe_discovery_runs" USING btree ("run_type");--> statement-breakpoint
CREATE INDEX "idx_recipe_discovery_runs_started_at" ON "recipe_discovery_runs" USING btree ("started_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_recipe_of_the_day_date" ON "recipe_of_the_day" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_recipe_of_the_day_recipe_id" ON "recipe_of_the_day" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "api_key_usage_api_key_id_idx" ON "api_key_usage" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "api_key_usage_requested_at_idx" ON "api_key_usage" USING btree ("requested_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "api_key_usage_endpoint_idx" ON "api_key_usage" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "api_key_usage_status_code_idx" ON "api_key_usage" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "api_key_usage_method_idx" ON "api_key_usage" USING btree ("method");--> statement-breakpoint
CREATE INDEX "api_key_usage_api_key_date_idx" ON "api_key_usage" USING btree ("api_key_id","requested_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "api_key_usage_endpoint_status_idx" ON "api_key_usage" USING btree ("endpoint","status_code");--> statement-breakpoint
CREATE INDEX "api_key_usage_error_idx" ON "api_key_usage" USING btree ("error_code");--> statement-breakpoint
CREATE INDEX "api_key_usage_response_time_idx" ON "api_key_usage" USING btree ("response_time_ms" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "api_keys_is_active_idx" ON "api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "api_keys_expires_at_idx" ON "api_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "api_keys_created_at_idx" ON "api_keys" USING btree ("created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "api_keys_last_used_at_idx" ON "api_keys" USING btree ("last_used_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "api_keys_environment_idx" ON "api_keys" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "api_keys_user_active_idx" ON "api_keys" USING btree ("user_id","is_active");