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

Use the unpooled URL (`DATABASE_URL_UNPOOLED`): the regex rejects a `-pooler` host. Do read-only checks inside `BEGIN READ ONLY`. Never print the URL.

`0004` (#103) is `ADD COLUMN` (nullable, no default, so no table rewrite) plus one `CREATE UNIQUE INDEX` on `recipe_flags`. It does not use `CONCURRENTLY`: `recipe_flags` had 0 rows on production on 2026-10-29, and `drizzle-kit migrate` runs each migration in a transaction, where `CONCURRENTLY` is not allowed.

Do not edit a migration after it is applied anywhere: the migrator stores each file's sha256.

## `baseline-mark-applied.sql`

Production does not need this script. Keep it only for a new environment whose schema was built with `drizzle-kit push`: it records the baseline as applied without running it, so `drizzle-kit migrate` then applies only the later migrations. Run it by hand with psql, once. If the baseline file or its journal entry changes, recompute the hash and `when` in it.

## Archive

`archive/` holds the pre-baseline history, migrations 0000-0023 with their snapshots, journal and rollback SQL. Production was built with `drizzle-kit push`, so these files never matched it. They are kept for reference only; drizzle-kit does not read them.
