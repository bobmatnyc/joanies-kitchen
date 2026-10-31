'use client';

import type { Session } from 'next-auth';
import { useSession } from 'next-auth/react';

/** The Auth.js session user: `id`, `name`, `email`, `image`, `isAdmin`. */
export type SessionUser = Session['user'];

/**
 * Why: client components need the signed-in user from the Auth.js session.
 * A session without a user id counts as signed out, the same rule the server
 * helpers in `src/lib/session-user.ts` apply.
 * What: wraps `useSession()`. `isLoaded` is false while the session loads;
 * `user` is the session user when it has an `id`, else null. `user.isAdmin`
 * is the JWT copy of `users.is_admin` — a UI hint only; server actions
 * re-check the database. Requires `<AuthProvider>` (SessionProvider) above it.
 * Test: `src/lib/__tests__/use-session-user.test.tsx`
 */
export function useSessionUser(): { isLoaded: boolean; user: SessionUser | null } {
  const { data, status } = useSession();
  const user = data?.user?.id ? data.user : null;
  return { isLoaded: status !== 'loading', user };
}
