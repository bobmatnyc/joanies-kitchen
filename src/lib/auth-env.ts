/**
 * Auth.js environment checks — #22. Edge-safe (no imports).
 */

/**
 * Returns true when AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are all
 * set. When false the app runs signed-out: the `@/lib/auth` shim reports no
 * user and middleware treats every request as anonymous, so protected and
 * admin routes stay closed.
 */
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
  );
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
