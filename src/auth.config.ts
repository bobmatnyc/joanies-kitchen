import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Edge-safe Auth.js configuration — #22.
 *
 * Why: `src/middleware.ts` runs on the edge on nearly every request, so it
 * must verify the session JWT without a database call (issue #22 §3).
 * What: Google as the only provider, 7-day JWT sessions, and a `session`
 * callback that exposes the token's user id and admin flag. No adapter, no
 * DB-backed callbacks — those live in `src/auth.ts`, which extends this.
 * Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the env.
 * Test: `src/lib/__tests__/auth-config.test.ts`
 */
export const authConfig = {
  providers: [
    Google({
      // #22: link a Google login to its pre-seeded `users` row by email. The
      // signIn callback in src/auth.ts admits only pre-seeded, verified emails.
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          // #22: users.email is stored lower-case; match that here.
          email: profile.email?.trim().toLowerCase(),
          image: profile.picture,
        };
      },
    }),
  ],
  pages: {
    signIn: '/sign-in',
    error: '/sign-in',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.isAdmin = token.isAdmin === true;
      return session;
    },
  },
} satisfies NextAuthConfig;
