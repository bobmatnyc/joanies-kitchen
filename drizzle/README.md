# Drizzle migrations

`0000_baseline_from_prod.sql` is the baseline. It reproduces production's schema, which is the source of truth (owner ruling D7a, #9 and #7). It was generated from the code schema after the code was aligned with production, and checked against a `drizzle-kit pull` of production with zero differences.

Production already has this schema. Do NOT run the baseline against production, and do NOT run `drizzle-kit migrate` against production until the baseline is recorded there. To record it, run `baseline-mark-applied.sql` by hand with psql, once, after a dry run on a Neon branch. That file inserts the baseline's sha256 and journal `when` into `drizzle.__drizzle_migrations`. If the baseline file or its journal entry changes, recompute both values.

The baseline's only hand edit is the `CREATE EXTENSION` prepend. `0001` adds `recipe_embeddings_recipe_id_unique` (owner ruling D7d); it is the first migration production runs after the baseline is recorded.

New migrations are generated with `drizzle-kit generate`, reviewed, dry-run on a Neon branch, and applied to production by hand with psql.

## Archive

`archive/` holds the pre-baseline history, migrations 0000-0023 with their snapshots, journal and rollback SQL. Production was built with `drizzle-kit push`, so these files never matched it. They are kept for reference only; drizzle-kit does not read them.
