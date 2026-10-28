import type { PgDatabase } from 'drizzle-orm/pg-core';
import { getAdminEmails } from '@/lib/auth-env';
import { normalizeEmail } from '@/lib/auth-users';
import { users } from '@/lib/db/auth-schema';

/**
 * Pre-seeding of Auth.js sign-in users — #22.
 *
 * Why: registration is closed, so a person can sign in only after an
 * operator seeds a `users` row with their Google email. Seeding the row with
 * an existing (Clerk-era) user id keeps all of that user's data attached.
 * The id and email are passed on the command line so no PII is committed.
 * What: `parseSeedArgs` validates `--id`, `--email`, `--admin`, `--dry-run`
 * and throws on anything missing or malformed. Without `--email` it takes
 * the single email in AUTH_ADMIN_EMAILS (#22 A06) and refuses when that list
 * is empty or holds more than one. An email in AUTH_ADMIN_EMAILS is always
 * seeded as admin. `seedAuthUser` upserts the row by id and sets `is_admin`
 * to the resolved flag (re-running an unlisted email without `--admin`
 * revokes admin).
 * Test: `src/lib/__tests__/auth-seed.test.ts`
 */

export interface SeedArgs {
  id: string;
  email: string;
  isAdmin: boolean;
  dryRun: boolean;
}

export const SEED_USAGE =
  'Usage: pnpm auth:seed-user --id <users.id> [--email <google-email>] [--admin] [--dry-run]';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseSeedArgs(argv: string[], adminEmails: string[] = getAdminEmails()): SeedArgs {
  let id: string | undefined;
  let email: string | undefined;
  let isAdmin = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--id' || arg === '--email') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${arg} needs a value. ${SEED_USAGE}`);
      }
      if (arg === '--id') id = value;
      else email = value;
      i++;
    } else if (arg === '--admin') {
      isAdmin = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else {
      throw new Error(`Unknown argument "${arg}". ${SEED_USAGE}`);
    }
  }

  const trimmedId = id?.trim();
  if (!trimmedId) throw new Error(`--id is required. ${SEED_USAGE}`);
  let normalized = normalizeEmail(email);
  if (!normalized) {
    // #22 (A06): fall back to AUTH_ADMIN_EMAILS only when it names exactly one email.
    if (adminEmails.length === 0) {
      throw new Error(`--email is required (AUTH_ADMIN_EMAILS is unset or empty). ${SEED_USAGE}`);
    }
    if (adminEmails.length > 1) {
      throw new Error(
        `--email is required: AUTH_ADMIN_EMAILS lists ${adminEmails.length} emails. ${SEED_USAGE}`
      );
    }
    normalized = adminEmails[0];
  }
  if (!EMAIL_RE.test(normalized)) throw new Error(`--email is not a valid email address.`);

  // #22 (A06): a listed email is always an admin, matching what sign-in grants.
  const listed = adminEmails.includes(normalized);
  return { id: trimmedId, email: normalized, isAdmin: isAdmin || listed, dryRun };
}

/** Upserts the user row by id. Throws on a DB error (e.g. the email belongs to another id). */
export async function seedAuthUser(
  // biome-ignore lint/suspicious/noExplicitAny: any Drizzle pg driver (neon-http, pg-proxy in tests)
  database: PgDatabase<any, any>,
  args: Pick<SeedArgs, 'id' | 'email' | 'isAdmin'>
): Promise<{ id: string; isAdmin: boolean }> {
  const [row] = await database
    .insert(users)
    .values({ id: args.id, email: args.email, is_admin: args.isAdmin })
    .onConflictDoUpdate({ target: users.id, set: { email: args.email, is_admin: args.isAdmin } })
    .returning({ id: users.id, isAdmin: users.is_admin });
  if (!row) throw new Error('Seed upsert returned no row.');
  return row;
}

/** Masks an email for logs: `ab***@example.com`. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain ?? ''}`;
}
