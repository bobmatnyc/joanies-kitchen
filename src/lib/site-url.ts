/**
 * #163: single source of the site base URL. `NEXT_PUBLIC_APP_URL` can carry a
 * trailing newline (pasted into the host's env UI), which put a line break
 * inside every sitemap `<loc>`. Client-safe: no server-only imports or node APIs.
 */

const DEFAULT_BASE_URL = 'https://joanies.kitchen';

/** Trim whitespace/newlines and trailing slashes; empty or unset gives ''. */
export function normalizeBaseUrl(value: string | undefined | null): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

/** Normalized `NEXT_PUBLIC_APP_URL`, or `fallback` when unset or blank. */
export function getBaseUrl(fallback: string = DEFAULT_BASE_URL): string {
  // Literal property access so Next inlines the value into the client bundle.
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) || normalizeBaseUrl(fallback);
}
