CREATE TABLE "joanie_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text,
	"meal_id" uuid,
	"ingredient_id" uuid,
	"comment_text" text NOT NULL,
	"comment_type" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "type" varchar(50);--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "subtype" varchar(100);--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "storage_tips" text;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "substitutions" text;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "qa_status" varchar(50) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "qa_timestamp" timestamp;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "qa_method" varchar(100);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "qa_confidence" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "qa_notes" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "qa_issues_found" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "qa_fixes_applied" text;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "type" varchar(50);--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "subtype" varchar(100);--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "joanie_comments" ADD CONSTRAINT "joanie_comments_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "joanie_comments_recipe_id_idx" ON "joanie_comments" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "joanie_comments_meal_id_idx" ON "joanie_comments" USING btree ("meal_id");--> statement-breakpoint
CREATE INDEX "joanie_comments_ingredient_id_idx" ON "joanie_comments" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "joanie_comments_type_idx" ON "joanie_comments" USING btree ("comment_type");--> statement-breakpoint
CREATE INDEX "joanie_comments_created_at_idx" ON "joanie_comments" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ingredients_slug_idx" ON "ingredients" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ingredients_type_idx" ON "ingredients" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ingredients_subtype_idx" ON "ingredients" USING btree ("subtype");--> statement-breakpoint
CREATE INDEX "ingredients_type_subtype_idx" ON "ingredients" USING btree ("type","subtype");--> statement-breakpoint
CREATE INDEX "idx_recipes_qa_status" ON "recipes" USING btree ("qa_status");--> statement-breakpoint
CREATE INDEX "idx_recipes_qa_timestamp" ON "recipes" USING btree ("qa_timestamp");--> statement-breakpoint
CREATE INDEX "idx_recipes_qa_method" ON "recipes" USING btree ("qa_method");--> statement-breakpoint
CREATE INDEX "tools_type_idx" ON "tools" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tools_subtype_idx" ON "tools" USING btree ("subtype");--> statement-breakpoint
CREATE INDEX "tools_type_subtype_idx" ON "tools" USING btree ("type","subtype");--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "recipe_embeddings" ADD CONSTRAINT "recipe_embeddings_recipe_id_unique" UNIQUE("recipe_id");