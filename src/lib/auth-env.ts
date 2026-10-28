/**
 * Auth.js environment check — #22. Edge-safe (no imports).
 *
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
