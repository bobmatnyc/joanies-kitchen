'use client';

import type { SessionContextValue } from 'next-auth/react';
import { SessionContext, SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

// #154: the fixed signed-out value used when Auth.js is not configured.
const SIGNED_OUT: SessionContextValue = {
  data: null,
  status: 'unauthenticated',
  update: async () => null,
};

/**
 * Why: #22 — Auth.js SessionProvider replaces ClerkProvider and Google One
 * Tap; its periodic refetch also lets the Node `jwt` callback refresh isAdmin.
 * #154 — with Auth.js unconfigured (a Vercel preview) every session fetch
 * fails with a "server configuration" error logged on each page load.
 * What: `enabled` (the layout passes `isAuthConfigured()`) mounts the real
 * SessionProvider; otherwise children get a fixed signed-out session and no
 * request is made to `/api/auth/session`.
 * Test: `src/components/auth/__tests__/AuthProvider.test.tsx`
 */
export function AuthProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  // #154: no Auth.js config → render signed-out without fetching the session.
  if (!enabled) {
    return <SessionContext.Provider value={SIGNED_OUT}>{children}</SessionContext.Provider>;
  }
  return <SessionProvider refetchInterval={5 * 60}>{children}</SessionProvider>;
}
