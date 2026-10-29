/** E2E test-auth gates: production and non-loopback targets must never mint a session. */
import { decode } from 'next-auth/jwt';
import { describe, expect, it } from 'vitest';
import { assertTestAuthAllowed, mintTestSessionCookie, TEST_USER } from '../e2e/setup/test-session';

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
