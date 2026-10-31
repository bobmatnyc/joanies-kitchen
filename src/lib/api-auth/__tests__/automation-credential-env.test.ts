// @vitest-environment node
/**
 * #238: the automation test credential is accepted only outside production.
 * Production is decided from `VERCEL_ENV`, then `NODE_ENV`, and an
 * undetermined environment counts as production. The key lookup and the
 * session lookup are stubbed; the middleware and `requireScopes` are real.
 */

import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NORMAL_KEY = 'jk_live_normal_key'; // pragma: allowlist secret
const CREDENTIAL = 'automation-credential-for-tests'; // pragma: allowlist secret

const validateApiKey = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-auth/key-service', () => ({
  validateApiKey,
  trackApiUsage: vi.fn(async () => undefined),
}));
vi.mock('@/lib/admin', () => ({
  checkAdminAccess: async () => ({ userId: null, isAdmin: false }),
}));

import { authenticateRequest } from '@/lib/api-auth/middleware';
import { requireScopes } from '@/lib/api-auth/require-auth';
import type { RouteContext } from '@/lib/api-auth/types';

const route = requireScopes(['read:recipes'], async (_r, auth) =>
  NextResponse.json({ userId: auth.userId })
);

function request(token: string) {
  return new NextRequest('http://localhost/api/v1/test', {
    headers: { authorization: `Bearer ${token}` },
  });
}

const call = (token: string) =>
  route(request(token), { params: Promise.resolve({}) } as RouteContext);

/** Stubs the deployment environment; `undefined` leaves the variable unset. */
function deployment(vercelEnv: string | undefined, nodeEnv: string | undefined) {
  vi.stubEnv('VERCEL_ENV', vercelEnv);
  vi.stubEnv('NODE_ENV', nodeEnv);
}

beforeEach(() => {
  vi.stubEnv('AUTOMATION_BYPASS_SECRET', CREDENTIAL);
  validateApiKey.mockImplementation(async (key: string) =>
    key === NORMAL_KEY
      ? {
          valid: true,
          userId: 'user_member',
          scopes: ['read:recipes'],
          apiKey: { id: 'key-1', name: 'normal', environment: 'production' },
          owner: { isAdmin: false, deletionPending: false },
        }
      : { valid: false, error: 'Invalid API key', reason: 'invalid_credentials' }
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  validateApiKey.mockReset();
});

describe('refused environments', () => {
  it.each([
    ['VERCEL_ENV=production', 'production', 'production'],
    ['no VERCEL_ENV, NODE_ENV=production', undefined, 'production'],
    ['an undetermined environment', undefined, undefined],
    ['an unrecognised VERCEL_ENV', 'staging', 'development'],
  ])('%s: the credential is an ordinary unknown key (401)', async (_name, vercel, node) => {
    deployment(vercel, node);

    const res = await call(CREDENTIAL);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: 'Invalid API key',
      reason: 'invalid_credentials',
      authType: 'api_key',
    });
    expect(validateApiKey).toHaveBeenCalledWith(CREDENTIAL);
  });
});

describe('non-production environments', () => {
  it.each([
    ['preview', 'preview', 'production'],
    ['development', 'development', 'development'],
    ['test (no VERCEL_ENV)', undefined, 'test'],
  ])('%s: the credential is accepted', async (_name, vercel, node) => {
    deployment(vercel, node);

    const auth = await authenticateRequest(request(CREDENTIAL));

    expect(auth).toMatchObject({
      authenticated: true,
      userId: 'automation-test-user',
      apiKeyId: 'automation',
    });
    expect(validateApiKey).not.toHaveBeenCalled();
  });
});

it('a normal API key still works in production', async () => {
  deployment('production', 'production');

  const res = await call(NORMAL_KEY);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ userId: 'user_member' });
});
