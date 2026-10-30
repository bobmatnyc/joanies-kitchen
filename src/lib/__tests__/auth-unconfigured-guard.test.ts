/**
 * #154: server-side session reads and admin gates key off `isAuthConfigured()`
 * alone, so a preview without Auth.js env vars reads no session and production
 * with missing config still denies admin (fail closed).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authJs: vi.fn(), getUserAdminFlag: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.authJs }));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: mocks.getUserAdminFlag }));

import { authorizeAdminOrCronSecret, checkAdminAccess } from '@/lib/admin';

function setEnv(vercelEnv: 'preview' | 'production', configured: boolean) {
  vi.stubEnv('VERCEL_ENV', vercelEnv);
  vi.stubEnv('CRON_SECRET', '');
  vi.stubEnv('AUTH_SECRET', configured ? 'test-secret' : '');
  vi.stubEnv('AUTH_GOOGLE_ID', configured ? 'test-id' : '');
  vi.stubEnv('AUTH_GOOGLE_SECRET', configured ? 'test-google-secret' : '');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.authJs.mockResolvedValue({ user: { id: 'user_1', isAdmin: true } });
  mocks.getUserAdminFlag.mockResolvedValue(true);
});

describe('server auth with Auth.js unconfigured (#154)', () => {
  it('preview + unconfigured: no session read, signed-out', async () => {
    setEnv('preview', false);
    await expect(checkAdminAccess()).resolves.toMatchObject({ isAdmin: false, userId: null });
    expect(mocks.authJs).not.toHaveBeenCalled();
  });

  it('preview + configured: the session is read', async () => {
    setEnv('preview', true);
    await expect(checkAdminAccess()).resolves.toMatchObject({ isAdmin: true, userId: 'user_1' });
    expect(mocks.authJs).toHaveBeenCalledTimes(1);
  });

  it('production + unconfigured: admin-gated route is denied 401', async () => {
    setEnv('production', false);
    const res = await authorizeAdminOrCronSecret(new Request('https://joanies.kitchen/api/x'));
    expect(res?.status).toBe(401);
    expect(mocks.authJs).not.toHaveBeenCalled();
    expect(mocks.getUserAdminFlag).not.toHaveBeenCalled();
  });
});
