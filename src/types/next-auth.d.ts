import type { DefaultSession } from 'next-auth';

// #22: session and JWT fields added by src/auth.config.ts and src/lib/auth-callbacks.ts.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      /** JWT copy of users.is_admin; up to 5 minutes stale. Gate with requireAdmin(). */
      isAdmin: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isAdmin?: boolean;
    /** Epoch ms of the last successful users.is_admin read. */
    adminCheckedAt?: number;
    /** #60 D5f: set when the local-staging bypass provider minted this token. */
    localStaging?: boolean;
  }
}
