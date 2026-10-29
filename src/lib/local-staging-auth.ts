/**
 * #60 D5f: local-staging auth bypass predicate. Edge-safe (no runtime imports
 * beyond the pure loopback parser), so middleware, the sign-in page and the
 * Node Auth.js instance all share one answer.
 *
 * Local EVO staging has no Google OAuth client. When this predicate is true,
 * `src/auth.ts` registers a Credentials provider that signs in as the one
 * email in LOCAL_STAGING_AUTH_EMAIL. When it is false nothing changes.
 */
import { loopbackHostname } from '@/lib/db/local-neon';

type BypassEnv = Record<string, string | undefined>;

/** The Credentials provider id; also the `account.provider` Auth.js reports. */
export const LOCAL_STAGING_PROVIDER_ID = 'local-staging';

/** The only flag value that enables the bypass. `true`, `yes`, ` 1` etc. do not. */
const FLAG_VALUE = '1';

/** Any of these set (to anything, even empty) means a Vercel runtime: never bypass. */
const VERCEL_MARKERS = ['VERCEL', 'VERCEL_ENV', 'VERCEL_URL'] as const;

/**
 * Why: owner ruling D5f — local staging logs in without Google, and that
 * shortcut must never be reachable in production.
 * What: returns the configured bypass email (trimmed, lower-cased) only when
 * ALL hold: LOCAL_STAGING_AUTH_BYPASS is exactly "1"; LOCAL_STAGING_AUTH_EMAIL
 * is a non-blank address; DATABASE_URL's parsed hostname is exactly loopback;
 * and none of VERCEL, VERCEL_ENV, VERCEL_URL is defined. Anything else,
 * including any thrown error, returns undefined. Pure: reads only `env`.
 * Test: `src/lib/__tests__/local-staging-auth.test.ts`
 */
export function localStagingAuthEmail(env: BypassEnv = process.env): string | undefined {
  try {
    // #60 D5f: a Vercel runtime marker wins over every other input.
    if (VERCEL_MARKERS.some((key) => env[key] !== undefined)) return undefined;
    if (env.LOCAL_STAGING_AUTH_BYPASS !== FLAG_VALUE) return undefined;

    const email = env.LOCAL_STAGING_AUTH_EMAIL?.trim().toLowerCase();
    if (!email || !email.includes('@')) return undefined;

    const databaseUrl = env.DATABASE_URL;
    if (!databaseUrl || loopbackHostname(databaseUrl) === undefined) return undefined;
    return email;
  } catch {
    // #60 D5f: fail closed — an unexpected error never activates the bypass.
    return undefined;
  }
}

/** True when the local-staging auth bypass is active (see `localStagingAuthEmail`). */
export function isLocalStagingAuthBypassActive(env: BypassEnv = process.env): boolean {
  return localStagingAuthEmail(env) !== undefined;
}
