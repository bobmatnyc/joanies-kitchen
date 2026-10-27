ALTER TABLE "recipes" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "is_public" boolean DEFAULT false;