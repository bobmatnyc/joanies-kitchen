/**
 * #22: admin gates re-read users.is_admin on every call and never trust the
 * JWT copy. A DB failure denies.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sessionUser: vi.fn(),
  sessionUserId: vi.fn(),
  getUserAdminFlag: vi.fn(),
}));

vi.mock('@/lib/session-user', () => ({
  getSessionUser: mocks.sessionUser,
  getSessionUserId: mocks.sessionUserId,
}));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: mocks.getUserAdminFlag }));

import { authorizeAdminOrCronSecret, checkAdminAccess, requireAdmin } from '@/lib/admin';

/** A session whose JWT copy says the user IS an admin. */
function tokenSaysAdmin() {
  mocks.sessionUser.mockResolvedValue({ id: 'user_1', isAdmin: true });
  mocks.sessionUserId.mockResolvedValue('user_1');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('requireAdmin', () => {
  it('reads users.is_admin on every call', async () => {
    tokenSaysAdmin();
    mocks.getUserAdminFlag.mockResolvedValue(true);
    await expect(requireAdmin()).resolves.toEqual({ userId: 'user_1' });
    await expect(requireAdmin()).resolves.toEqual({ userId: 'user_1' });
    expect(mocks.getUserAdminFlag).toHaveBeenCalledTimes(2);
    expect(mocks.getUserAdminFlag).toHaveBeenCalledWith('user_1');
  });

  it('denies when the DB says not admin even though the token says admin', async () => {
    tokenSaysAdmin();
    mocks.getUserAdminFlag.mockResolvedValue(false);
    await expect(requireAdmin()).rejects.toThrow('Admin access required');
  });

  it('denies when the user row is missing', async () => {
    tokenSaysAdmin();
    mocks.getUserAdminFlag.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow('Admin access required');
  });

  it('denies with the admin error (not the raw DB error) when the lookup fails', async () => {
    tokenSaysAdmin();
    mocks.getUserAdminFlag.mockRejectedValue(new Error('db down'));
    await expect(requireAdmin()).rejects.toThrow('Admin access required');
  });

  it('denies a signed-out caller without a DB read', async () => {
    mocks.sessionUser.mockResolvedValue(null);
    mocks.sessionUserId.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow('Admin access required');
    expect(mocks.getUserAdminFlag).not.toHaveBeenCalled();
  });
});

describe('checkAdminAccess', () => {
  it('reports a signed-out caller as not admin, with no user id and no DB read', async () => {
    mocks.sessionUser.mockResolvedValue(null);
    mocks.sessionUserId.mockResolvedValue(null);
    await expect(checkAdminAccess()).resolves.toEqual({ isAdmin: false, userId: null });
    expect(mocks.getUserAdminFlag).not.toHaveBeenCalled();
  });

  it('resolves isAdmin false (does not throw) when the lookup fails', async () => {
    tokenSaysAdmin();
    mocks.getUserAdminFlag.mockRejectedValue(new Error('db down'));
    await expect(checkAdminAccess()).resolves.toMatchObject({ isAdmin: false, userId: 'user_1' });
  });
});

describe('authorizeAdminOrCronSecret', () => {
  it('returns 403 when the admin lookup fails for a signed-in user', async () => {
    vi.stubEnv('CRON_SECRET', '');
    tokenSaysAdmin();
    mocks.getUserAdminFlag.mockRejectedValue(new Error('db down'));
    const res = await authorizeAdminOrCronSecret(new Request('https://joanies.kitchen/api/x'));
    expect(res?.status).toBe(403);
  });
});
