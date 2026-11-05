ALTER TABLE "recipe_flags" ADD COLUMN "rating_id" uuid;--> statement-breakpoint
ALTER TABLE "recipe_ratings" ADD COLUMN "review_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_flags" ADD CONSTRAINT "recipe_flags_rating_id_recipe_ratings_id_fk" FOREIGN KEY ("rating_id") REFERENCES "public"."recipe_ratings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_flags_rating_user_unique" ON "recipe_flags" USING btree ("rating_id","user_id");--> statement-breakpoint
ALTER TABLE "recipe_flags" ADD CONSTRAINT "recipe_flags_single_target_check" CHECK (num_nonnulls(comment_id, rating_id) <= 1);