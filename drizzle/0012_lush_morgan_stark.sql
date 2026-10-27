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
ALTER TABLE "recipes" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "chefs" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "recipe_source_types" ADD CONSTRAINT "recipe_source_types_source_id_recipe_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."recipe_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_source_types_source_id_idx" ON "recipe_source_types" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "recipe_sources_slug_idx" ON "recipe_sources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "recipe_sources_is_active_idx" ON "recipe_sources" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_source_id_recipe_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."recipe_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chefs" ADD CONSTRAINT "chefs_source_id_recipe_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."recipe_sources"("id") ON DELETE set null ON UPDATE no action;