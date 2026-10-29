/**
 * #104 (D7c S5): permanent purge of accounts whose 30-day grace period has ended.
 *
 * Why: S4 only hides an account; /privacy promises permanent deletion after
 * the grace period.
 * What: `purgeDueAccounts` selects non-admin users whose
 * `deletion_requested_at` is at least `DELETION_GRACE_PERIOD_MS` old (oldest
 * first, `PURGE_ACCOUNTS_PER_RUN` per run) and purges each in turn:
 * 1. collect the Vercel Blob URLs only this account references;
 * 2. delete those blobs;
 * 3. run `purgeStatements` as one `db.batch`, `users` row last.
 *
 * A failure in any step leaves that account's `users` row in place, is logged,
 * is counted in `failed`, and the run moves to the next account. Re-running
 * is safe: deleted blobs and rows are simply absent the second time, and the
 * batch commits whole or not at all.
 * Test: `src/lib/account-purge/__tests__/account-purge.test.ts`
 */

import { del } from '@vercel/blob';
import { and, asc, eq, isNotNull, lte } from 'drizzle-orm';
import { DELETION_GRACE_PERIOD_MS } from '@/lib/account-deletion';
import { isEnvAdminEmail } from '@/lib/auth-env';
import { db } from '@/lib/db';
import { users } from '@/lib/db/auth-schema';
import { collectPurgeBlobUrls } from './blobs';
import { type PurgeTarget, purgeStatements } from './statements';

export { DELETED_USER_ID, PURGE_COLUMN_PLAN } from './statements';

/** Accounts purged per run; the rest wait for the next daily run. */
export const PURGE_ACCOUNTS_PER_RUN = 25;

export interface PurgeRunResult {
  purged: string[];
  failed: { userId: string; error: string }[];
  /** Due accounts held back because their email is in AUTH_ADMIN_EMAILS. */
  skipped: string[];
}

/** Purges one account. Rejects on any failure; the `users` row is then still present. */
export async function purgeAccount(t: PurgeTarget): Promise<void> {
  const urls = await collectPurgeBlobUrls(t);
  if (urls.length > 0) await del(urls);
  const [first, ...rest] = purgeStatements(t);
  await db.batch([first, ...rest]);
}

/** Purges every due account, one at a time. Never rejects for a per-account failure. */
export async function purgeDueAccounts(now: Date = new Date()): Promise<PurgeRunResult> {
  const cutoff = new Date(now.getTime() - DELETION_GRACE_PERIOD_MS);
  const due = await db
    .select({ id: users.id, email: users.email, keep: users.deletion_keep_recipes })
    .from(users)
    .where(
      and(
        isNotNull(users.deletion_requested_at),
        lte(users.deletion_requested_at, cutoff),
        eq(users.is_admin, false)
      )
    )
    .orderBy(asc(users.deletion_requested_at))
    .limit(PURGE_ACCOUNTS_PER_RUN);

  const result: PurgeRunResult = { purged: [], failed: [], skipped: [] };
  for (const user of due) {
    if (isEnvAdminEmail(user.email)) {
      console.error(`[purgeDueAccounts] skipped admin-email account ${user.id}`);
      result.skipped.push(user.id);
      continue;
    }
    try {
      await purgeAccount({
        userId: user.id,
        email: user.email,
        keepRecipes: user.keep === true,
        cutoff,
      });
      result.purged.push(user.id);
    } catch (error) {
      // Drizzle wraps the driver error; its cause carries the database's reason.
      const cause = error instanceof Error && error.cause instanceof Error ? error.cause : null;
      const base = error instanceof Error ? error.message : String(error);
      const message = cause ? `${base}: ${cause.message}` : base;
      console.error(`[purgeDueAccounts] purge failed for ${user.id}:`, error);
      result.failed.push({ userId: user.id, error: message });
    }
  }
  return result;
}
