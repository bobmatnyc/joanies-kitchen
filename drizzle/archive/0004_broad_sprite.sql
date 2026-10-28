CREATE TABLE "recipe_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" text NOT NULL,
	"embedding" vector(384) NOT NULL,
	"embedding_text" text NOT NULL,
	"model_name" varchar(100) DEFAULT 'all-MiniLM-L6-v2' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
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
ALTER TABLE "recipes" ADD COLUMN "search_query" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "discovery_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "confidence_score" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "validation_model" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "discovery_week" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "discovery_year" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "published_date" timestamp;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "system_rating" numeric(2, 1);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "system_rating_reason" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "avg_user_rating" numeric(2, 1);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "total_user_ratings" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "recipe_embeddings" ADD CONSTRAINT "recipe_embeddings_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ratings" ADD CONSTRAINT "recipe_ratings_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_ratings_recipe_id_idx" ON "recipe_ratings" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_ratings_user_id_idx" ON "recipe_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_recipes_rating" ON "recipes" USING btree ("system_rating" DESC NULLS LAST,"avg_user_rating" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_recipes_created" ON "recipes" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_recipes_user_public" ON "recipes" USING btree ("user_id","is_public");--> statement-breakpoint
CREATE INDEX "idx_recipes_system" ON "recipes" USING btree ("is_system_recipe");--> statement-breakpoint
CREATE INDEX "idx_recipes_cuisine" ON "recipes" USING btree ("cuisine");--> statement-breakpoint
CREATE INDEX "idx_recipes_difficulty" ON "recipes" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "idx_recipes_public_system" ON "recipes" USING btree ("is_public","is_system_recipe");--> statement-breakpoint
CREATE INDEX "idx_recipes_discovery_week" ON "recipes" USING btree ("discovery_year","discovery_week");