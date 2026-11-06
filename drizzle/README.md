# Drizzle migrations

`0000_baseline_from_prod.sql` is the baseline. It reproduces production's schema, which is the source of truth (owner ruling D7a, #9 and #7). It was generated from the code schema after the code was aligned with production, and checked against a `drizzle-kit pull` of production with zero differences. Its only hand edit is the `CREATE EXTENSION` prepend.

## Production state

Production is on the migrate path. `drizzle.__drizzle_migrations` on production records the baseline, `0001` (`recipe_embeddings_recipe_id_unique`, owner ruling D7d) and `0002`; the stored hashes match those files.

`0003` captures the `joanie_comments` `updated_at` trigger and its function, which production already had but no migration created (D14). It is a no-op on production: `CREATE OR REPLACE FUNCTION` with an identical body, and a `CREATE TRIGGER` guarded by an existence check.

## Process for a new migration

1. Generate it with `drizzle-kit generate` (or `drizzle-kit generate --custom --name <name>` for hand-written SQL), so the journal and snapshot stay consistent.
2. Review the SQL in a PR.
3. Dry run `drizzle-kit migrate` on a Neon branch of production.
4. After owner/Architect go-ahead, apply it to production with `drizzle-kit migrate`.

### Production host check

Before any read or write against production, assert the connection host matches

```
^ep-jolly-snow-addxski4\.[a-z0-9.-]+\.aws\.neon\.tech$
```

<!-- D3a: pooled pg_dump broke prod reads; unpooled host only -->
Use the unpooled URL (`DATABASE_URL_UNPOOLED`) for `pg_dump`, `psql`, `drizzle-kit` and every admin script: the regex rejects a `-pooler` host. Match the whole host against the anchored regex, never a substring such as `*ep-jolly-snow-addxski4*`, which also accepts `ep-jolly-snow-addxski4-pooler...`. pg_dump sets `search_path` to `''` for its session, and PgBouncer transaction pooling leaks that onto shared backends: two pooled dumps each broke prod reads of `recipe_comments`. Do read-only checks inside `BEGIN READ ONLY`. Never print the URL.

```bash
# D3a: pooled pg_dump broke prod reads; unpooled host only
host=$(node -e 'console.log(new URL(process.env.DATABASE_URL_UNPOOLED).hostname)')
[[ "$host" =~ ^ep-jolly-snow-addxski4\.[a-z0-9.-]+\.aws\.neon\.tech$ ]] || { echo "refusing: host is not the unpooled prod host"; exit 1; }
pg_dump "$DATABASE_URL_UNPOOLED" > backup.sql
```

TypeScript admin scripts use `src/lib/db/admin-db-url.ts`: `adminDbUrl(url, purpose, { prod: true })` refuses a pooled host and checks the anchored regex; `toUnpooledUrl` strips `-pooler` explicitly.

`0004` (#103) is `ADD COLUMN` (nullable, no default, so no table rewrite) plus one `CREATE UNIQUE INDEX` on `recipe_flags`. It does not use `CONCURRENTLY`: `recipe_flags` had 0 rows on production on 2026-10-29, and `drizzle-kit migrate` runs each migration in a transaction, where `CONCURRENTLY` is not allowed.

`0005` (#135) creates two new tables, `recipe_redirects` and `dedup_135_ledger`, for the duplicate-recipe merge (`scripts/dedup-135/apply.ts`). It touches no existing table; the only new constraint on existing data is the `recipe_redirects.to_recipe_id` FK to `recipes`. Applied to production.

`0006` (#131) is one `CREATE INDEX ... USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64)` on `recipe_embeddings`. It needs pgvector >= 0.8.0, for the `hnsw.iterative_scan` setting `findSimilarRecipes` uses. It does not use `CONCURRENTLY`, for the same transaction reason as `0004`; the build blocks writes to `recipe_embeddings` while it runs (1.28 s for 5039 rows on a Neon branch of production). Applied to production.

`0007` (#142, owner ruling D1b) is `ADD COLUMN "canonical_source_url" text` (nullable, no default, so no table rewrite) plus one non-unique `CREATE INDEX` on `recipes`. The recipe insert path writes the column (9fc9245, #142). 0008 later replaced this non-unique index with a partial unique index. It does not use `CONCURRENTLY`, for the same transaction reason as `0004`. `ADD COLUMN` takes `ACCESS EXCLUSIVE` on `recipes`, and the migrator's transaction holds that lock through the index build, so reads and writes of `recipes` wait until commit. Apply it before deploying the code that carries this schema: Drizzle names every schema column in `db.select().from(recipes)` and in inserts, and those queries fail on a database without the column. Applied to production (#267, merged 2026-11-01).

`0008` (#142, owner ruling D09) creates the partial unique index `recipes_canonical_source_url_live_unique` on `recipes ("canonical_source_url") WHERE "deleted_at" IS NULL`, then drops 0007's non-unique `idx_recipes_canonical_source_url`. The unique index serves every lookup of a live recipe by canonical URL; no query reads soft-deleted rows by that column, so the second index would only add write cost. NULLs stay allowed (Postgres treats NULLs as distinct). A `DO` block first counts duplicate groups among live rows and rows pending account deletion (`deleted_by LIKE 'account-deletion:%'`, which a deletion cancel or the purge makes live again) and raises `unique_violation` naming them, so the migration stops, with nothing changed, until the duplicates are merged; the index build would also fail on them, with a less useful message. No `CONCURRENTLY`, for the same transaction reason as `0004`; the build holds a `SHARE` lock on `recipes`, so writes wait while it runs (reads continue). Once it is applied, a #135 merge rollback fails with 23505 when it would make a loser live again with the same canonical URL as a live recipe. Applied to production (#276, merged 2026-11-02).

`0009` (#270, owner decision D72) is additive: `recipe_ratings.review_hidden boolean NOT NULL DEFAULT false` (a constant default, so no table rewrite), `recipe_flags.rating_id uuid` (nullable) with an FK to `recipe_ratings(id)` `ON DELETE cascade`, the unique index `recipe_flags_rating_user_unique` on `(rating_id, user_id)`, and the CHECK `recipe_flags_single_target_check` (`num_nonnulls(comment_id, rating_id) <= 1`: a report targets a comment or a rating review, never both; a recipe report has neither). Nothing is dropped or rewritten. The FK cascade is what removes a rating's reports when the rating is deleted (`deleteRating`, the account purge, a recipe delete). No `CONCURRENTLY`, for the same transaction reason as `0004`; `ADD COLUMN`, the FK, the index and the CHECK each take a short lock on `recipe_ratings` or `recipe_flags`, both small tables. Apply it before deploying the code that carries this schema: `rateRecipe`'s insert-select and every `select()` from `recipe_ratings` name `review_hidden`, so they fail on a database without it. Not applied to production yet.

Do not edit a migration after it is applied anywhere: the migrator stores each file's sha256.

## `baseline-mark-applied.sql`

Production does not need this script. Keep it only for a new environment whose schema was built with `drizzle-kit push`: it records the baseline as applied without running it, so `drizzle-kit migrate` then applies only the later migrations. Run it by hand with psql, once. If the baseline file or its journal entry changes, recompute the hash and `when` in it.

## Archive

`archive/` holds the pre-baseline history, migrations 0000-0023 with their snapshots, journal and rollback SQL. Production was built with `drizzle-kit push`, so these files never matched it. They are kept for reference only; drizzle-kit does not read them.
