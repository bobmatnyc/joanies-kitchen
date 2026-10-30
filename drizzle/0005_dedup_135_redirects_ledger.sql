CREATE TABLE "dedup_135_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"group_id" text NOT NULL,
	"kind" text NOT NULL,
	"table_name" text,
	"column_name" text,
	"row_pk" jsonb,
	"old_recipe_id" text,
	"new_recipe_id" text,
	"row_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rolled_back_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recipe_redirects" (
	"from_recipe_id" text PRIMARY KEY NOT NULL,
	"from_slug" text,
	"to_recipe_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_redirects" ADD CONSTRAINT "recipe_redirects_to_recipe_id_recipes_id_fk" FOREIGN KEY ("to_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_dedup_135_ledger_batch_group" ON "dedup_135_ledger" USING btree ("batch_id","group_id");--> statement-breakpoint
CREATE INDEX "idx_dedup_135_ledger_group_kind" ON "dedup_135_ledger" USING btree ("group_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_redirects_from_slug_unique" ON "recipe_redirects" USING btree ("from_slug") WHERE "recipe_redirects"."from_slug" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_recipe_redirects_to_recipe_id" ON "recipe_redirects" USING btree ("to_recipe_id");