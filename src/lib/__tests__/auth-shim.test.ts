/**
 * #22: the Clerk-shaped `auth()` shim maps an Auth.js session and reports
 * signed-out when Auth.js is not configured.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authJs: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.authJs }));

import { auth } from '@/lib/auth';

function configure() {
  vi.stubEnv('AUTH_SECRET', 'test-secret');
  vi.stubEnv('AUTH_GOOGLE_ID', 'test-id');
  vi.stubEnv('AUTH_GOOGLE_SECRET', 'test-google-secret');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('auth() shim', () => {
  it('maps a session to the Clerk-shaped result', async () => {
    configure();
    mocks.authJs.mockResolvedValue({ user: { id: 'user_1', isAdmin: true, name: 'A' } });
    await expect(auth()).resolves.toMatchObject({
      userId: 'user_1',
      sessionClaims: { metadata: { isAdmin: 'true' } },
      user: { id: 'user_1', name: 'A' },
    });
  });

  it('returns signed-out for no session', async () => {
    configure();
    mocks.authJs.mockResolvedValue(null);
    await expect(auth()).resolves.toMatchObject({ userId: null, sessionClaims: null });
  });

  it.each(['AUTH_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'])(
    'returns signed-out without reading the session when %s is unset',
    async (name) => {
      configure();
      vi.stubEnv(name, '');
      mocks.authJs.mockResolvedValue({ user: { id: 'user_1', isAdmin: true } });
      await expect(auth()).resolves.toMatchObject({ userId: null, sessionClaims: null });
      expect(mocks.authJs).not.toHaveBeenCalled();
    }
  );
});
