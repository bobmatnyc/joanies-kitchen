/** E2E test-auth gates: production and non-loopback targets must never mint a session. */
import type { JWT } from 'next-auth/jwt';
import { decode } from 'next-auth/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_CLAIM_TTL_MS, refreshAdminClaim } from '@/lib/auth-callbacks';
import {
  assertTestAuthAllowed,
  mintTestSessionCookie,
  neonTestUserStore,
  prepareTestSession,
  removeTestUser,
  TEST_USER,
  type TestUserStore,
} from '../e2e/setup/test-session';

// In-memory `users` table shared by the fake store and the mocked app query.
const usersTable = new Map<string, { isAdmin: boolean }>();
vi.mock('@/lib/auth-users', () => ({
  normalizeEmail: (e: string | null | undefined) => e?.trim().toLowerCase() || null,
  findUserIdByEmail: vi.fn(),
  grantUserAdmin: vi.fn(),
  getUserAdminFlag: vi.fn(async (id: string) => usersTable.get(id)?.isAdmin ?? null),
}));

const fakeStore: TestUserStore = {
  upsert: vi.fn(async (user) => {
    usersTable.set(user.id, { isAdmin: false });
  }),
  remove: vi.fn(async (id) => {
    usersTable.delete(id);
  }),
};
const getFakeStore = vi.fn(async () => fakeStore);

const LOCAL = 'http://localhost:3002';
const ok = { E2E_TEST_AUTH: '1', NODE_ENV: 'test', AUTH_SECRET: 'test-secret-0123456789' };

describe('assertTestAuthAllowed', () => {
  it.each([
    ['NODE_ENV=production', { ...ok, NODE_ENV: 'production' }, LOCAL],
    ['VERCEL_ENV=production', { ...ok, VERCEL_ENV: 'production' }, LOCAL],
    ['flag unset', { ...ok, E2E_TEST_AUTH: undefined }, LOCAL],
    ['flag not exactly 1', { ...ok, E2E_TEST_AUTH: 'true' }, LOCAL],
    ['production host', ok, 'https://joanies.kitchen'],
    ['AUTH_SECRET unset', { ...ok, AUTH_SECRET: undefined }, LOCAL],
  ])('refuses when %s', (_label, env, url) => {
    expect(() => assertTestAuthAllowed(env, url)).toThrow();
  });

  it('refuses to mint a cookie under production NODE_ENV', async () => {
    await expect(mintTestSessionCookie({ ...ok, NODE_ENV: 'production' }, LOCAL)).rejects.toThrow(
      /production/
    );
  });

  it('allows a flagged, non-production, loopback target', () => {
    expect(assertTestAuthAllowed(ok, LOCAL)).toBe(ok.AUTH_SECRET);
  });
});

describe('mintTestSessionCookie', () => {
  it('mints a session JWT that Auth.js decodes with the same secret', async () => {
    const cookie = await mintTestSessionCookie(ok, LOCAL, 1_000_000);
    expect(cookie).toMatchObject({ name: 'authjs.session-token', domain: 'localhost' });
    const token = await decode({ token: cookie.value, secret: ok.AUTH_SECRET, salt: cookie.name });
    expect(token).toMatchObject({ sub: TEST_USER.id, isAdmin: false });
  });
});

describe('prepareTestSession', () => {
  beforeEach(() => {
    usersTable.clear();
    vi.clearAllMocks();
  });

  it('keeps the session alive past the admin-claim TTL because it seeds the user row', async () => {
    const mintedAt = 1_000_000;
    const cookie = await prepareTestSession(ok, LOCAL, getFakeStore, mintedAt);
    const token = (await decode({
      token: cookie.value,
      secret: ok.AUTH_SECRET,
      salt: cookie.name,
    })) as JWT;

    const refreshed = await refreshAdminClaim({ token, now: mintedAt + ADMIN_CLAIM_TTL_MS + 1 });

    expect(refreshed, 'session dropped after the TTL: no users row').not.toBeNull();
    expect(refreshed?.sub).toBe(TEST_USER.id);
  });

  it.each([
    ['NODE_ENV=production', { ...ok, NODE_ENV: 'production' }, LOCAL],
    ['flag unset', { ...ok, E2E_TEST_AUTH: undefined }, LOCAL],
    ['production host', ok, 'https://joanies.kitchen'],
    ['AUTH_SECRET unset', { ...ok, AUTH_SECRET: undefined }, LOCAL],
  ])('never opens the database when %s', async (_label, env, url) => {
    await expect(prepareTestSession(env, url, getFakeStore)).rejects.toThrow();
    await expect(removeTestUser(env, url, getFakeStore)).rejects.toThrow();
    expect(getFakeStore).not.toHaveBeenCalled();
  });

  it('teardown removes the seeded row', async () => {
    await prepareTestSession(ok, LOCAL, getFakeStore);
    await removeTestUser(ok, LOCAL, getFakeStore);
    expect(usersTable.has(TEST_USER.id)).toBe(false);
  });
});

describe('neonTestUserStore', () => {
  it('fails loudly with a migration hint when the users table is missing', async () => {
    vi.doMock('@neondatabase/serverless', () => ({
      neon: () => () => Promise.reject(Object.assign(new Error('no table'), { code: '42P01' })),
      neonConfig: {}, // #60: read by the local-proxy guard
    }));
    const store = await neonTestUserStore({ DATABASE_URL: 'postgresql://x' });
    await expect(store.upsert(TEST_USER)).rejects.toThrow(/pnpm db:migrate/);
    vi.doUnmock('@neondatabase/serverless');
  });
});
