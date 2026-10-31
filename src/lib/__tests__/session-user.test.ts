/**
 * #22: `getSessionUser()` / `getSessionUserId()` read the Auth.js session and
 * report signed-out when Auth.js is not configured, without reading it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authJs: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.authJs }));

import { getSessionUser, getSessionUserId } from '@/lib/session-user';

// See #22: a legacy user keeps the Clerk-era id string in `users.id`.
const CLERK_ERA_ID = 'user_2abcDEF123ghiJKL456mnoPQR789';

function configure() {
  vi.stubEnv('AUTH_SECRET', 'test-secret');
  vi.stubEnv('AUTH_GOOGLE_ID', 'test-id');
  vi.stubEnv('AUTH_GOOGLE_SECRET', 'test-google-secret');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('session-user helpers', () => {
  it.each(['user_1', CLERK_ERA_ID, 'b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d'])(
    'signed in: returns the exact id %s and the session user',
    async (id) => {
      configure();
      const user = { id, isAdmin: true, name: 'A' };
      mocks.authJs.mockResolvedValue({ user });
      await expect(getSessionUserId()).resolves.toBe(id);
      await expect(getSessionUser()).resolves.toBe(user);
    }
  );

  it('signed out: no session returns null', async () => {
    configure();
    mocks.authJs.mockResolvedValue(null);
    await expect(getSessionUserId()).resolves.toBeNull();
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it.each([{ user: undefined }, { user: {} }, { user: { id: '' } }, { user: { name: 'A' } }])(
    'a session with no user.id returns null (%o)',
    async (session) => {
      configure();
      mocks.authJs.mockResolvedValue(session);
      await expect(getSessionUserId()).resolves.toBeNull();
      await expect(getSessionUser()).resolves.toBeNull();
    }
  );

  it.each(['AUTH_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'])(
    'auth unconfigured: returns null without reading the session when %s is unset',
    async (name) => {
      configure();
      vi.stubEnv(name, '');
      mocks.authJs.mockResolvedValue({ user: { id: 'user_1', isAdmin: true } });
      await expect(getSessionUserId()).resolves.toBeNull();
      await expect(getSessionUser()).resolves.toBeNull();
      expect(mocks.authJs).not.toHaveBeenCalled();
    }
  );
});
