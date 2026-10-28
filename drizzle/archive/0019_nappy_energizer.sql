ALTER TABLE "ingredients" ADD COLUMN "is_purchaseable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "last_cleaned_at" timestamp;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "last_cleaned_model" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "moderation_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "moderation_notes" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "moderated_by" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "moderated_at" timestamp;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "submission_notes" text;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
CREATE INDEX "idx_recipes_moderation_status" ON "recipes" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "idx_recipes_moderation_pending" ON "recipes" USING btree ("moderation_status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tools_slug_idx" ON "tools" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_slug_unique" UNIQUE("slug");