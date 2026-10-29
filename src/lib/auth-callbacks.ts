import type { Account, Profile, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { isWithinGracePeriod } from '@/lib/account-deletion';
import { issueUndoToken } from '@/lib/account-deletion/undo-token';
import { isEnvAdminEmail } from '@/lib/auth-env';
import {
  findPendingDeletionByEmail,
  findUserIdByEmail,
  getUserSessionState,
  grantUserAdmin,
  normalizeEmail,
} from '@/lib/auth-users';

/**
 * Auth.js callbacks that need the database — #22.
 *
 * Why: registration is closed (issue #22 §9 Q1) and the admin flag lives in
 * `users.is_admin`. These callbacks run in Node only (`src/auth.ts`); the
 * edge middleware never imports this file.
 * What: `authorizeSignIn` admits a Google login only when its verified email
 * matches a pre-seeded `users` row or is listed in AUTH_ADMIN_EMAILS;
 * `refreshAdminClaim` sets `is_admin` for a listed email at sign-in and
 * copies `is_admin` into the JWT at most every ADMIN_CLAIM_TTL_MS. Both fail
 * closed. #103: a user with a pending account deletion gets no session —
 * sign-in redirects to the undo page and the refresh ends an existing JWT.
 * Test: `src/lib/__tests__/auth-callbacks.test.ts`,
 * `src/lib/account-deletion/__tests__/account-deletion.test.ts`
 */

/** #103: where a blocked sign-in sends a user with a pending deletion. */
export const UNDO_DELETION_PATH = '/account/undo-deletion';

/** How long the JWT copy of `is_admin` is trusted before it is re-read. */
export const ADMIN_CLAIM_TTL_MS = 5 * 60 * 1000;

interface SignInParams {
  user?: User | null;
  account?: Account | null;
  profile?: Profile | null;
}

/**
 * Returns true only for a Google account whose verified email belongs to a
 * pre-seeded user or is listed in AUTH_ADMIN_EMAILS. A missing email, an unverified email, an unknown email,
 * another provider, or a database error all return false (Auth.js then
 * redirects to `/sign-in?error=AccessDenied`).
 *
 * #103: a user with a pending deletion is refused a session. Inside the grace
 * period the callback returns the undo page URL with a signed undo token
 * (Auth.js redirects there without signing in); after it, false.
 */
export async function authorizeSignIn({
  user,
  account,
  profile,
}: SignInParams): Promise<boolean | string> {
  // #22: Google is the only provider; anything else is refused.
  if (account?.provider !== 'google') return false;

  // #22: email linking is only safe for an address Google has verified.
  if (profile?.email_verified !== true) return false;

  const email = normalizeEmail(user?.email ?? profile?.email);
  if (!email) return false;

  try {
    // #103: checked before the admin shortcut so no email bypasses it.
    const pending = await findPendingDeletionByEmail(email);
    if (pending) {
      if (!isWithinGracePeriod(pending.requestedAt)) return false;
      const token = issueUndoToken({
        userId: pending.userId,
        requestedAtMs: pending.requestedAt.getTime(),
      });
      return `${UNDO_DELETION_PATH}?token=${encodeURIComponent(token)}`;
    }
  } catch (error) {
    // #103: fail closed — an unknown deletion state must not admit a login.
    console.error('[auth] deletion-state lookup failed; denying sign-in:', error);
    return false;
  }

  // #22 (A06): a listed admin email may sign in without a seeded row. It is
  // checked only after the provider and verified-email gates above.
  if (isEnvAdminEmail(email)) return true;

  try {
    // #22: closed registration — only pre-seeded emails may sign in.
    const userId = await findUserIdByEmail(email);
    return userId !== null;
  } catch (error) {
    // #22: fail closed — a DB error must never admit a login.
    console.error('[auth] sign-in lookup failed; denying sign-in:', error);
    return false;
  }
}

interface JwtParams {
  token: JWT;
  user?: User | null;
  now?: number;
}

/**
 * Keeps `token.isAdmin` in step with `users.is_admin`.
 *
 * On sign-in (`user` present) the id is copied into `token.sub`; a user whose
 * email is in AUTH_ADMIN_EMAILS first gets `is_admin = true` written to the
 * DB (a failed write leaves the token non-admin); then the flag is read.
 * Afterwards it is re-read when older than the TTL. A user row that no
 * longer exists, or (#103) has a pending account deletion, ends the session
 * (returns null) at the next re-read, so within the TTL. A DB error clears the admin
 * flag and leaves the timestamp stale so the next call retries.
 */
export async function refreshAdminClaim({
  token,
  user,
  now = Date.now(),
}: JwtParams): Promise<JWT | null> {
  if (user?.id) {
    token.sub = user.id;
    token.adminCheckedAt = 0;
    token.isAdmin = false;
    if (isEnvAdminEmail(user.email)) {
      try {
        // #22 (A06): a listed email becomes an admin in the DB at sign-in.
        await grantUserAdmin(user.id);
      } catch (error) {
        // #22: fail closed — the grant failed, so the token carries no admin;
        // adminCheckedAt stays 0 so the next call re-reads users.is_admin.
        console.error('[auth] admin grant failed; isAdmin cleared:', error);
        return token;
      }
    }
  }
  if (!token.sub) return token;

  const checkedAt = typeof token.adminCheckedAt === 'number' ? token.adminCheckedAt : 0;
  if (now - checkedAt < ADMIN_CLAIM_TTL_MS) return token;

  try {
    const state = await getUserSessionState(token.sub);
    // #22: the user row is gone — end the session.
    if (state === null) return null;
    // #103: a pending account deletion ends the session.
    if (state.deletionPending) return null;
    token.isAdmin = state.isAdmin;
    token.adminCheckedAt = now;
  } catch (error) {
    // #22: fail closed — drop admin until a refresh succeeds.
    console.error('[auth] admin claim refresh failed; clearing isAdmin:', error);
    token.isAdmin = false;
  }
  return token;
}
