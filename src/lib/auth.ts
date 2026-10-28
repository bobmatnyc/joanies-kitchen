import type { Session } from 'next-auth';
import { auth as authJs } from '@/auth';
import { isAuthConfigured } from '@/lib/auth-env';

/**
 * Clerk-shaped compatibility shim over Auth.js — #22.
 *
 * Why: ~45 server files call `auth()` and read `userId` the way Clerk's
 * `auth()` returned it. Keeping that shape lets them switch by changing
 * only their import line (issue #22 §8); a follow-up PR removes the shim.
 * What: returns `{ userId, sessionId, sessionClaims, orgId, orgRole, orgSlug, user }`.
 * `userId` is the `users.id` of the signed-in user, or null. `sessionClaims`
 * carries the JWT copy of the admin flag as `metadata.isAdmin` ('true' |
 * 'false'); it can be up to 5 minutes stale, so never gate on it — use
 * `checkAdminAccess()` / `requireAdmin()` from `@/lib/admin`, which re-read
 * the database. When Auth.js env vars are missing it reports signed-out.
 * Test: `src/lib/__tests__/auth-shim.test.ts`
 */

export interface AuthResult {
  userId: string | null;
  sessionId: null;
  sessionClaims: { metadata: { isAdmin: 'true' | 'false' } } | null;
  orgId: null;
  orgRole: null;
  orgSlug: null;
  user: Session['user'] | null;
}

const SIGNED_OUT: AuthResult = {
  userId: null,
  sessionId: null,
  sessionClaims: null,
  orgId: null,
  orgRole: null,
  orgSlug: null,
  user: null,
};

export async function auth(): Promise<AuthResult> {
  // #22: no Auth.js config means nobody is signed in (fail closed).
  if (!isAuthConfigured()) return { ...SIGNED_OUT };

  const session = await authJs();
  const user = session?.user;
  if (!user?.id) return { ...SIGNED_OUT };

  return {
    ...SIGNED_OUT,
    userId: user.id,
    sessionClaims: { metadata: { isAdmin: user.isAdmin === true ? 'true' : 'false' } },
    user,
  };
}
