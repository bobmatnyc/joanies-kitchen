-- Rollback for drizzle/0023_authjs_users.sql (#22).
-- Drops only the three tables 0023 creates. No existing table is touched.
-- `accounts` goes first because it holds the foreign key to `users`.
-- Apply by hand with psql, inside a transaction, after confirming the
-- deployment no longer uses Auth.js (see docs/guides/authentication.md).
BEGIN;
DROP TABLE IF EXISTS "accounts";
DROP TABLE IF EXISTS "verification_tokens";
DROP TABLE IF EXISTS "users";
COMMIT;
