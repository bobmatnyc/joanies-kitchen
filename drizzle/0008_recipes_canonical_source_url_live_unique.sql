-- #142 (owner ruling D09): one live recipe per canonical_source_url.
-- Live means deleted_at IS NULL (the recipes soft-delete column). NULL URLs stay allowed.
-- Refuses to run while live duplicates exist: merge them first (#135 merge tooling).
DO $$
DECLARE
  dup_groups integer;
  sample text;
BEGIN
  SELECT count(*), string_agg(canonical_source_url, ', ' ORDER BY canonical_source_url)
    INTO dup_groups, sample
  FROM (
    SELECT canonical_source_url
    FROM "recipes"
    WHERE "deleted_at" IS NULL AND "canonical_source_url" IS NOT NULL
    GROUP BY canonical_source_url
    HAVING count(*) > 1
  ) d;
  IF dup_groups > 0 THEN
    RAISE EXCEPTION '0008: % live duplicate group(s) on recipes.canonical_source_url; merge them before this migration: %',
      dup_groups, left(sample, 2000)
      USING ERRCODE = 'unique_violation';
  END IF;
END
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_canonical_source_url_live_unique" ON "recipes" USING btree ("canonical_source_url") WHERE "recipes"."deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX "idx_recipes_canonical_source_url";
