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
ALTER TABLE "recipe_flags" ADD CONSTRAINT "recipe_flags_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_flags_recipe_id_idx" ON "recipe_flags" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_flags_status_idx" ON "recipe_flags" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recipe_flags_user_id_idx" ON "recipe_flags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_flags_created_at_idx" ON "recipe_flags" USING btree ("created_at" DESC NULLS LAST);