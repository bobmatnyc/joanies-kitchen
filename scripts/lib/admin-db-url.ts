/**
 * Connection-string guard for admin DB tools (D3a).
 *
 * Why: pg_dump through Neon's pooled host set `search_path=''` on a shared
 * PgBouncer backend and broke prod reads twice. The old host check was a
 * substring match, which also accepted the `-pooler` host.
 * What: explicit `-pooler` stripping, a separate pooled-host refusal for
 * dump/DDL, and an anchored prod-host regex. No error message carries the
 * connection string or any part of its credentials.
 * Test: `scripts/lib/__tests__/admin-db-url.test.ts`
 *
 * The app's runtime DATABASE_URL handling (src/lib/db) does not use this.
 */

// D3a: pooled pg_dump broke prod reads; unpooled host only
export const PROD_HOST_REGEX = /^ep-jolly-snow-addxski4\.[a-z0-9.-]+\.aws\.neon\.tech$/;

/** First label of the prod endpoint; a host carrying it is a prod target. */
const PROD_ENDPOINT_ID = 'ep-jolly-snow-addxski4';
const POOLER_SUFFIX = '-pooler';

export type AdminDbPurpose = 'dump' | 'ddl' | 'migrate' | 'seed' | 'backup' | 'admin';

export class AdminDbUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminDbUrlError';
  }
}

/** Parses without ever echoing the input (URL's own error carries it). */
function parse(connectionString: string): URL {
  try {
    const url = new URL(connectionString);
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') throw new Error();
    return url;
  } catch {
    throw new AdminDbUrlError(
      'connection string is not a valid postgresql:// URL (value not shown)'
    );
  }
}

function firstLabel(hostname: string): string {
  return hostname.split('.')[0] ?? '';
}

/** True when the endpoint label (before the first dot) ends in `-pooler`. */
export function isPooledHost(connectionString: string): boolean {
  return firstLabel(parse(connectionString).hostname).endsWith(POOLER_SUFFIX);
}

/** Returns the same connection string with `-pooler` removed from the endpoint label. */
export function toUnpooledUrl(connectionString: string): string {
  const url = parse(connectionString);
  const [label, ...rest] = url.hostname.split('.');
  if (!label?.endsWith(POOLER_SUFFIX)) return url.toString();
  url.hostname = [label.slice(0, -POOLER_SUFFIX.length), ...rest].join('.');
  return url.toString();
}

/** Throws when the host is pooled. Call before any dump, DDL or admin session. */
export function assertUnpooledHost(connectionString: string, purpose: AdminDbPurpose): void {
  if (isPooledHost(connectionString)) {
    throw new AdminDbUrlError(
      `refusing ${purpose}: host is a Neon -pooler endpoint; use the unpooled host (value not shown)`
    );
  }
}

/** True when the host names the prod endpoint at all (pooled, lookalike or real). */
export function isProdTarget(connectionString: string): boolean {
  return parse(connectionString).hostname.startsWith(PROD_ENDPOINT_ID);
}

/** Throws unless the host matches the anchored prod regex exactly. */
export function assertProdHost(connectionString: string): void {
  if (!PROD_HOST_REGEX.test(parse(connectionString).hostname)) {
    throw new AdminDbUrlError(
      `host does not match ${PROD_HOST_REGEX.source}; refusing prod admin run (value not shown)`
    );
  }
}

/**
 * The single entry point for admin tools. Refuses a pooled host, and for a
 * prod target (named prod endpoint, or `{ prod: true }`) requires the
 * anchored regex. Returns the string unchanged.
 * Callers that want the pooled host rewritten call `toUnpooledUrl` first.
 */
export function adminDbUrl(
  connectionString: string | undefined,
  purpose: AdminDbPurpose,
  opts: { prod?: boolean } = {}
): string {
  if (!connectionString) throw new AdminDbUrlError(`refusing ${purpose}: no connection string set`);
  assertUnpooledHost(connectionString, purpose);
  if (opts.prod || isProdTarget(connectionString)) assertProdHost(connectionString);
  return connectionString;
}
