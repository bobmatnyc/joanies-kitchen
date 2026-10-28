# Drizzle migrations

`0000_baseline_from_prod.sql` is the baseline. It reproduces production's schema, which is the source of truth (owner ruling D7a, #9 and #7). It was generated from the code schema after the code was aligned with production, and checked against a `drizzle-kit pull` of production with zero differences.

Production already has this schema. Do NOT run the baseline against production, and do NOT run `drizzle-kit migrate` against production until the baseline is recorded there. To record it, run `baseline-mark-applied.sql` by hand with psql, once, after a dry run on a Neon branch. That file inserts the baseline's sha256 and journal `when` into `drizzle.__drizzle_migrations`. If the baseline file or its journal entry changes, recompute both values.

The baseline differs from the snapshot in one place: `recipe_embeddings_recipe_id_unique` is declared in code but absent from production. It is pending an owner ruling, so the SQL omits it while the snapshot keeps it. `chefs_embeddings` and `meals_embeddings` (`src/lib/db/embeddings-schema.ts`) are also pending and are not in `drizzle.config.ts`.

New migrations are generated with `drizzle-kit generate`, reviewed, dry-run on a Neon branch, and applied to production by hand with psql.

## Archive

`archive/` holds the pre-baseline history, migrations 0000-0023 with their snapshots, journal and rollback SQL. Production was built with `drizzle-kit push`, so these files never matched it. They are kept for reference only; drizzle-kit does not read them.
