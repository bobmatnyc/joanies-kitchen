CREATE TYPE "public"."inventory_status" AS ENUM('fresh', 'use_soon', 'expiring', 'expired', 'used', 'wasted');--> statement-breakpoint
CREATE TYPE "public"."storage_location" AS ENUM('fridge', 'freezer', 'pantry', 'other');--> statement-breakpoint
CREATE TYPE "public"."usage_action" AS ENUM('cooked', 'eaten_raw', 'composted', 'trashed', 'donated');--> statement-breakpoint
CREATE TYPE "public"."waste_outcome" AS ENUM('expired', 'spoiled', 'forgot_about_it', 'bought_too_much', 'overcooked', 'other');--> statement-breakpoint
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
ALTER TABLE "recipes" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_usage_log" ADD CONSTRAINT "inventory_usage_log_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_usage_log" ADD CONSTRAINT "inventory_usage_log_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_tracking" ADD CONSTRAINT "waste_tracking_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_tracking" ADD CONSTRAINT "waste_tracking_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "waste_tracking_user_id_idx" ON "waste_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "waste_tracking_ingredient_id_idx" ON "waste_tracking" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "waste_tracking_outcome_idx" ON "waste_tracking" USING btree ("user_id","outcome");--> statement-breakpoint
CREATE INDEX "waste_tracking_wasted_at_idx" ON "waste_tracking" USING btree ("user_id","wasted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "waste_tracking_inventory_item_id_idx" ON "waste_tracking" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "waste_tracking_cost_idx" ON "waste_tracking" USING btree ("user_id","cost_usd" DESC NULLS LAST);