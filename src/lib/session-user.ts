import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { isAuthConfigured } from '@/lib/auth-env';

/**
 * Why: server code needs the signed-in user without each caller repeating the
 * unconfigured-auth guard (#161/#154).
 * What: returns the Auth.js `session.user`, or null when Auth.js is not
 * configured (the session is then never read), when there is no session, or
 * when the session carries no `user.id`.
 * Test: `src/lib/__tests__/session-user.test.ts`
 */
export async function getSessionUser(): Promise<Session['user'] | null> {
  // #22: no Auth.js config means nobody is signed in (fail closed).
  if (!isAuthConfigured()) return null;

  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  return user;
}

/**
 * Why: almost every server caller needs only the signed-in user's id.
 * What: returns `session.user.id` exactly as stored in `users.id` — a legacy
 * user keeps the Clerk-era id string (See #22) — or null when signed out,
 * under the same rules as `getSessionUser()`.
 * Test: `src/lib/__tests__/session-user.test.ts`
 */
export async function getSessionUserId(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.id ?? null;
}
