# Drizzle migrations

Migrations 0000-0020 are a historical record. They do not reflect production's schema.

Production was built with `drizzle-kit push`, and its `drizzle.__drizzle_migrations` table is empty. Do NOT run `drizzle-kit migrate` against production.

New migrations are generated with `drizzle-kit generate`, reviewed, dry-run on a Neon branch, and applied to production by hand with psql.

Known schema drift between these files and production is tracked in the issues linked from #6.
