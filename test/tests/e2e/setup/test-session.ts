import { encode } from 'next-auth/jwt';

/**
 * Test-only NextAuth session minting for the E2E auth setup.
 *
 * Why: sessions are Auth.js JWTs signed with AUTH_SECRET and the only provider
 * is Google OAuth, which cannot be scripted deterministically. Minting the
 * session cookie in the Playwright process gives the dependent projects a real
 * signed session with no test-only code in the application.
 * What: `assertTestAuthAllowed` refuses unless E2E_TEST_AUTH=1, NODE_ENV and
 * VERCEL_ENV are not "production", and the target is a loopback URL.
 * `mintTestSessionCookie` encodes a JWT the app's middleware and `auth()`
 * accept, under the cookie name Auth.js uses for that URL's scheme.
 * Test: `test/tests/unit/e2e-test-session.test.ts`
 */

export const TEST_USER = {
  id: 'e2e-test-user',
  email: 'e2e-test-user@example.test',
  name: 'E2E Test User',
} as const;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

type Env = Record<string, string | undefined>;

/** Throws unless every test-auth gate passes. Returns AUTH_SECRET on success. */
export function assertTestAuthAllowed(env: Env, baseURL: string): string {
  if (env.E2E_TEST_AUTH !== '1') {
    throw new Error('Test auth is disabled: set E2E_TEST_AUTH=1 to mint an E2E session.');
  }
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') {
    throw new Error('Test auth is refused when NODE_ENV or VERCEL_ENV is "production".');
  }
  const host = new URL(baseURL).hostname;
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(`Test auth is refused for non-loopback host "${host}".`);
  }
  const secret = env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET must match the dev server AUTH_SECRET.');
  }
  return secret;
}

/** Auth.js cookie name: `__Secure-` prefixed on https, plain on http. */
export function sessionCookieName(baseURL: string): string {
  return new URL(baseURL).protocol === 'https:'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';
}

export interface MintedCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax';
}

/** Gates, then returns a Playwright cookie holding a signed session for TEST_USER. */
export async function mintTestSessionCookie(
  env: Env,
  baseURL: string,
  now = Date.now()
): Promise<MintedCookie> {
  const secret = assertTestAuthAllowed(env, baseURL);
  const name = sessionCookieName(baseURL);
  const maxAge = 24 * 60 * 60;
  const value = await encode({
    secret,
    salt: name,
    maxAge,
    token: {
      sub: TEST_USER.id,
      email: TEST_USER.email,
      name: TEST_USER.name,
      isAdmin: false,
      adminCheckedAt: now,
    },
  });
  const url = new URL(baseURL);
  return {
    name,
    value,
    domain: url.hostname,
    path: '/',
    expires: Math.floor(now / 1000) + maxAge,
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax',
  };
}
