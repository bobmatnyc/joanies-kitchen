'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

// #22: Auth.js SessionProvider replaces ClerkProvider and Google One Tap.
// The periodic refetch also lets the Node `jwt` callback refresh isAdmin.
export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider refetchInterval={5 * 60}>{children}</SessionProvider>;
}
