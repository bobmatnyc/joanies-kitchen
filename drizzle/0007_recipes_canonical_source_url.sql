ALTER TABLE "recipes" ADD COLUMN "canonical_source_url" text;--> statement-breakpoint
CREATE INDEX "idx_recipes_canonical_source_url" ON "recipes" USING btree ("canonical_source_url");