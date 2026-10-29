import path from 'node:path';
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

/** storageState file written by auth.setup.ts and read by the dependent specs. */
export const AUTH_FILE = path.join(__dirname, '../.auth/user.json');

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

/** Writes and removes the TEST_USER `users` row. A seam so unit tests need no database. */
export interface TestUserStore {
  upsert(user: typeof TEST_USER): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Postgres "undefined_table": the auth migration has not been applied. */
const UNDEFINED_TABLE = '42P01';

function migrationHint(error: unknown): never {
  if ((error as { code?: string })?.code === UNDEFINED_TABLE) {
    throw new Error(
      'E2E auth: the `users` table does not exist in DATABASE_URL. ' +
        'Run the auth migrations (`pnpm db:migrate`) against the dev database first.'
    );
  }
  throw error;
}

/** Store backed by DATABASE_URL through the Neon HTTP driver the app uses. */
export async function neonTestUserStore(env: Env): Promise<TestUserStore> {
  if (!env.DATABASE_URL) {
    throw new Error('E2E auth: DATABASE_URL must be set to seed the test user.');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(env.DATABASE_URL);
  return {
    async upsert(user) {
      await sql`INSERT INTO users (id, email, name, is_admin)
        VALUES (${user.id}, ${user.email}, ${user.name}, false)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email, name = EXCLUDED.name, is_admin = false`.catch(migrationHint);
    },
    async remove(id) {
      await sql`DELETE FROM users WHERE id = ${id}`.catch(migrationHint);
    },
  };
}

/**
 * Why: the jwt callback re-reads `users.is_admin` after ADMIN_CLAIM_TTL_MS and
 * ends the session when the row is missing, so a cookie with no row expires
 * after 5 minutes.
 * What: runs every gate first, then upserts the TEST_USER row, then mints.
 * Nothing touches the database when a gate fails.
 * Test: `test/tests/unit/e2e-test-session.test.ts`
 */
export async function prepareTestSession(
  env: Env,
  baseURL: string,
  getStore: () => Promise<TestUserStore>,
  now = Date.now()
): Promise<MintedCookie> {
  assertTestAuthAllowed(env, baseURL);
  const store = await getStore();
  await store.upsert(TEST_USER);
  return mintTestSessionCookie(env, baseURL, now);
}

/** Gated removal of the TEST_USER row, for the teardown project. */
export async function removeTestUser(
  env: Env,
  baseURL: string,
  getStore: () => Promise<TestUserStore>
): Promise<void> {
  assertTestAuthAllowed(env, baseURL);
  await (await getStore()).remove(TEST_USER.id);
}
