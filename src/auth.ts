import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';
import { authorizeSignIn, refreshAdminClaim } from '@/lib/auth-callbacks';
import { db } from '@/lib/db';
import { accounts, users, verificationTokens } from '@/lib/db/auth-schema';

/**
 * Node-side Auth.js instance — #22.
 *
 * Why: sign-in must check the database (closed registration) and the JWT
 * must carry a fresh `users.is_admin`; neither can run in edge middleware.
 * What: extends the edge-safe `authConfig` with the Drizzle adapter (users
 * and accounts only — sessions are JWTs) and the DB-backed `signIn` and
 * `jwt` callbacks. Exports the route `handlers`, `auth`, `signIn` and
 * `signOut`. Application code should call `@/lib/auth` (the compatibility
 * shim) or `@/lib/admin`, not this module directly.
 * The config is a function so the adapter (and the lazy `db`) is built per
 * request, not at import, which keeps `next build` free of DATABASE_URL.
 * Test: `src/lib/__tests__/auth-callbacks.test.ts`
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    ...authConfig.callbacks,
    signIn: (params) => authorizeSignIn(params),
    jwt: (params) => {
      // The adapter returns the stored users row, whose `image` can be null for a
      // pre-seeded user; take the picture Google just sent (default scopes) instead.
      if (params.profile?.picture) params.token.picture = params.profile.picture;
      return refreshAdminClaim(params);
    },
  },
}));
