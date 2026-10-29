/**
 * #60: route the neon-http driver to a local Neon HTTP proxy
 * (ghcr.io/timowilhelm/local-neon-http-proxy) when DATABASE_URL points at a
 * loopback host. Without this, @neondatabase/serverless 1.x sends queries to
 * `https://api.<host>/sql`, which is `Invalid URL https://api.0.0.1/sql` for 127.0.0.1.
 */
import type { NeonConfig } from '@neondatabase/serverless';

/** The proxy's documented listen port (`http://db.localtest.me:4444/sql`). */
export const DEFAULT_NEON_LOCAL_PROXY_PORT = 4444;

/** Exact loopback hostnames as `URL.hostname` reports them; anything else is remote. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', '[::1]', 'localhost']);

type ProxyEnv = Record<string, string | undefined>;

/**
 * Why: local staging (EVO) runs plain Postgres behind the local Neon HTTP proxy;
 * production must keep the driver's default endpoint untouched.
 * What: returns `http://<host>:<port>/sql` when the URL's parsed hostname is exactly
 * 127.0.0.1, ::1 or localhost, else `undefined`. Port comes from NEON_LOCAL_PROXY_PORT
 * (default 4444); a set but invalid port throws. Pure: reads only its arguments.
 * Test: `src/lib/db/__tests__/local-neon.test.ts`
 */
export function localNeonFetchEndpoint(
  databaseUrl: string,
  env: ProxyEnv = process.env
): string | undefined {
  let hostname: string;
  try {
    // postgres: is a non-special scheme, so the host is not lowercased for us.
    hostname = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return undefined; // neon() reports the malformed URL itself
  }
  if (!LOOPBACK_HOSTS.has(hostname)) return undefined;

  const rawPort = env.NEON_LOCAL_PROXY_PORT;
  let port = DEFAULT_NEON_LOCAL_PROXY_PORT;
  if (rawPort !== undefined && rawPort !== '') {
    port = Number(rawPort);
    if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
      throw new Error('NEON_LOCAL_PROXY_PORT must be an integer between 1 and 65535.');
    }
  }
  const host = hostname === '::1' ? '[::1]' : hostname;
  return `http://${host}:${port}/sql`;
}

/**
 * Why: the neon-http driver reads `neonConfig.fetchEndpoint` globally; only the
 * loopback case may change it.
 * What: sets `config.fetchEndpoint` to the local proxy endpoint for a loopback
 * DATABASE_URL and returns true; for any other URL it does not touch `config`.
 * Only fetchEndpoint is set: neon-http never uses the websocket options.
 * Test: `src/lib/db/__tests__/local-neon.test.ts`
 */
export function configureLocalNeonProxy(
  config: Pick<NeonConfig, 'fetchEndpoint'>,
  databaseUrl: string,
  env: ProxyEnv = process.env
): boolean {
  const endpoint = localNeonFetchEndpoint(databaseUrl, env);
  if (endpoint === undefined) return false;
  config.fetchEndpoint = endpoint;
  return true;
}
