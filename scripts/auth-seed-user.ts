/**
 * Pre-seed one Auth.js sign-in user — #22.
 *
 * Registration is closed: only an email that has a `users` row can sign in
 * with Google. Pass the existing app user id (for a Clerk-era user, their old
 * Clerk id) so all of their data stays attached.
 *
 * Usage:
 *   pnpm auth:seed-user --id <users.id> [--email <google-email>] [--admin] [--dry-run]
 *
 * Without --email the single address in AUTH_ADMIN_EMAILS is used (#22 A06);
 * an AUTH_ADMIN_EMAILS address is always seeded as admin. Emails are printed
 * masked. Reads DATABASE_URL and AUTH_ADMIN_EMAILS from .env.local (or the
 * environment). Requires migration 0023 to be applied. Re-running an
 * unlisted email without --admin revokes admin.
 * See docs/guides/authentication.md.
 */

import path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main(): Promise<void> {
  // Imported after dotenv so @/lib/db sees DATABASE_URL.
  const { maskEmail, parseSeedArgs, seedAuthUser } = await import('../src/lib/auth-seed');
  const args = parseSeedArgs(process.argv.slice(2));
  const summary = `id=${args.id} email=${maskEmail(args.email)} is_admin=${args.isAdmin}`;

  if (args.dryRun) {
    console.log(`[dry-run] would upsert users row: ${summary}`);
    return;
  }

  const { db } = await import('../src/lib/db');
  const row = await seedAuthUser(db, args);
  console.log(
    `Upserted users row: id=${row.id} is_admin=${row.isAdmin} email=${maskEmail(args.email)}`
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
