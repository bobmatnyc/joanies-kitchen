/**
 * #60 D5f: the Node-side half of the local-staging auth bypass.
 *
 * Why: local EVO staging has no Google OAuth client (owner ruling D5f), so it
 * signs in as the one LOCAL_STAGING_AUTH_EMAIL user instead.
 * What: `buildAuthProviders` returns the edge config's providers unchanged
 * (Google only) unless the bypass predicate holds, and then appends one
 * Credentials provider. That provider ignores all submitted input, re-checks
 * the predicate at call time, and resolves only the configured email's
 * pre-seeded `users` row. `authorizeLocalStagingSignIn` is the matching
 * `signIn` callback gate. Admin comes from the existing AUTH_ADMIN_EMAILS /
 * `users.is_admin` path in `refreshAdminClaim`; nothing here grants admin.
 * Test: `src/lib/__tests__/local-staging-auth-provider.test.ts`
 */
import type { Account, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from '@/auth.config';
import { findPendingDeletionByEmail, findUserIdByEmail, normalizeEmail } from '@/lib/auth-users';
import {
  isLocalStagingAuthBypassActive,
  LOCAL_STAGING_PROVIDER_ID,
  localStagingAuthEmail,
} from '@/lib/local-staging-auth';

type Env = Record<string, string | undefined>;

/**
 * #60 D5f: resolves the configured staging user, or null. Input is never read,
 * so no other email can be requested. Fails closed on a DB error, an unseeded
 * email or a pending account deletion (#103).
 */
export async function authorizeLocalStagingUser(env: Env = process.env): Promise<User | null> {
  const email = localStagingAuthEmail(env);
  if (!email) return null;
  try {
    if (await findPendingDeletionByEmail(email)) return null;
    const id = await findUserIdByEmail(email);
    return id ? { id, email } : null;
  } catch (error) {
    console.error('[auth] local-staging user lookup failed; denying sign-in:', error);
    return null;
  }
}

/** #60 D5f: the provider list. Bypass inactive → exactly `authConfig.providers`. */
export function buildAuthProviders(env: Env = process.env) {
  if (localStagingAuthEmail(env) === undefined) return authConfig.providers;
  return [
    ...authConfig.providers,
    Credentials({
      id: LOCAL_STAGING_PROVIDER_ID,
      name: 'Local staging',
      credentials: {},
      authorize: () => authorizeLocalStagingUser(env),
    }),
  ];
}

/**
 * #60 D5f: `signIn` gate for the bypass provider. True only while the bypass is
 * active and the signed-in user carries exactly the configured email.
 */
export function authorizeLocalStagingSignIn(
  { user, account }: { user?: User | null; account?: Account | null },
  env: Env = process.env
): boolean {
  if (account?.provider !== LOCAL_STAGING_PROVIDER_ID) return false;
  const email = localStagingAuthEmail(env);
  return email !== undefined && normalizeEmail(user?.email) === email;
}

/**
 * #60 D5f: `jwt` callback gate. On sign-in through the bypass provider the
 * token gets `localStaging = true`. A marked token returns null (Auth.js then
 * ends the session) whenever the bypass is inactive, so a staging-minted
 * cookie is never a session elsewhere, even under a shared AUTH_SECRET.
 * Unmarked tokens are returned unchanged.
 */
export function gateLocalStagingToken<T extends JWT>(
  { token, account }: { token: T; account?: Account | null },
  env: Env = process.env
): T | null {
  if (account?.provider === LOCAL_STAGING_PROVIDER_ID) token.localStaging = true;
  if (token.localStaging === true && !isLocalStagingAuthBypassActive(env)) return null;
  return token;
}
