/**
 * Auth.js environment checks — #22. Edge-safe (imports only the pure #60 D5f predicate).
 */
import { isLocalStagingAuthBypassActive } from '@/lib/local-staging-auth';

/** True when AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are all set. */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
  );
}

/** #60 D5f: AUTH_SECRET is set and the local-staging bypass predicate holds. */
export function isLocalStagingSignInEnabled(): boolean {
  return Boolean(process.env.AUTH_SECRET) && isLocalStagingAuthBypassActive();
}

/**
 * Returns true when Google sign-in is configured or (#60 D5f) the local-staging
 * bypass is enabled; with the bypass inactive this is exactly the Google check.
 * When false the app runs signed-out: the `@/lib/session-user` helpers report
 * no user and middleware treats every request as anonymous, so protected and
 * admin routes stay closed.
 * Always false on a Vercel preview deployment (`VERCEL_ENV === 'preview'`); an
 * unset or any other value counts as production and is unchanged.
 */
export function isAuthConfigured(): boolean {
  // #154: Auth.js stays off on preview deployments, whatever AUTH_* holds there.
  if (process.env.VERCEL_ENV === 'preview') return false;
  return isGoogleAuthConfigured() || isLocalStagingSignInEnabled();
}

/**
 * Why: the owner's admin emails must live only in the environment, never in
 * code, tests, docs or the database seed (#22 ruling A06).
 * What: parses AUTH_ADMIN_EMAILS (comma-separated) into trimmed, lower-case
 * emails. Unset, empty or only separators → an empty list, so no env-based
 * admin is granted.
 * Test: `src/lib/__tests__/auth-env.test.ts`
 */
export function getAdminEmails(): string[] {
  const raw = process.env.AUTH_ADMIN_EMAILS;
  // #22: unset or blank grants nothing.
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/** True when the (trimmed, case-insensitive) email is listed in AUTH_ADMIN_EMAILS. */
export function isEnvAdminEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return getAdminEmails().includes(normalized);
}
