ALTER TABLE "recipe_flags" ADD COLUMN "comment_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_keep_recipes" boolean;--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_flags_comment_user_unique" ON "recipe_flags" USING btree ("comment_id","user_id") WHERE "recipe_flags"."comment_id" IS NOT NULL;