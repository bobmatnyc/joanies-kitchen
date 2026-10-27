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
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
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
ALTER TABLE "meal_recipes" ADD CONSTRAINT "meal_recipes_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_recipes" ADD CONSTRAINT "meal_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "shopping_lists_user_id_idx" ON "shopping_lists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shopping_lists_meal_id_idx" ON "shopping_lists" USING btree ("meal_id");--> statement-breakpoint
CREATE INDEX "shopping_lists_status_idx" ON "shopping_lists" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shopping_lists_created_at_idx" ON "shopping_lists" USING btree ("created_at" DESC NULLS LAST);