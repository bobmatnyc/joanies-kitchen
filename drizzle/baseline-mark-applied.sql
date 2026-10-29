-- #9 / #7: record 0000_baseline_from_prod as applied WITHOUT running it.
-- Prod already has this row (and 0001/0002), so do NOT run this on prod.
-- Use it only for a new environment whose schema was built with
-- `drizzle-kit push`. After this row exists, `drizzle-kit migrate` skips the
-- baseline and applies only later migrations.
--
-- hash       = sha256 of drizzle/0000_baseline_from_prod.sql, byte for byte
--              (the value drizzle's migrator computes and stores).
-- created_at = `when` of tag 0000_baseline_from_prod in drizzle/meta/_journal.json.
-- If either file changes, recompute both values before running this.
--
-- Run by hand with psql, once per such environment. Not run by CI.
BEGIN;

CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '1ed34f4e21898721a23cbd94ec2dfd35537501650492e0198dbe85b7c050f838', 1793228970346
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations
  WHERE hash = '1ed34f4e21898721a23cbd94ec2dfd35537501650492e0198dbe85b7c050f838'
);

SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id;

COMMIT;
