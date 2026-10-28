/**
 * #22: the Auth.js signIn gate and the JWT admin refresh fail closed.
 * Every deny case here passes only while its guard in auth-callbacks.ts exists.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUserIdByEmail: vi.fn(),
  getUserAdminFlag: vi.fn(),
  grantUserAdmin: vi.fn(),
}));

vi.mock('@/lib/auth-users', async () => ({
  normalizeEmail: (e: string | null | undefined) => e?.trim().toLowerCase() || null,
  findUserIdByEmail: mocks.findUserIdByEmail,
  getUserAdminFlag: mocks.getUserAdminFlag,
  grantUserAdmin: mocks.grantUserAdmin,
}));

import { ADMIN_CLAIM_TTL_MS, authorizeSignIn, refreshAdminClaim } from '@/lib/auth-callbacks';

const GOOGLE = { provider: 'google', type: 'oidc', providerAccountId: 'g-1' } as const;
const SEEDED = 'seeded@example.test';

function signInWith(
  overrides: { email?: string | null; verified?: boolean; provider?: string } = {}
) {
  const email = overrides.email === undefined ? SEEDED : overrides.email;
  return authorizeSignIn({
    user: { id: 'g-1', email },
    account: { ...GOOGLE, provider: overrides.provider ?? 'google' },
    profile: { email, email_verified: overrides.verified ?? true },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // #22: never inherit a real admin list from the host environment.
  vi.stubEnv('AUTH_ADMIN_EMAILS', '');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.findUserIdByEmail.mockImplementation(async (email: string) =>
    email === SEEDED ? 'user_seeded' : null
  );
});

describe('authorizeSignIn', () => {
  it('admits a verified Google login whose email is pre-seeded', async () => {
    await expect(signInWith()).resolves.toBe(true);
    expect(mocks.findUserIdByEmail).toHaveBeenCalledWith(SEEDED);
  });

  it('matches the seeded email case-insensitively', async () => {
    await expect(signInWith({ email: '  Seeded@Example.TEST ' })).resolves.toBe(true);
  });

  it('denies an unknown email', async () => {
    await expect(signInWith({ email: 'stranger@example.test' })).resolves.toBe(false);
  });

  it('denies when the user lookup throws (DB error)', async () => {
    mocks.findUserIdByEmail.mockRejectedValue(new Error('db down'));
    await expect(signInWith()).resolves.toBe(false);
  });

  it.each([
    ['missing', null],
    ['blank', '   '],
  ])('denies a %s email without querying', async (_label, email) => {
    await expect(signInWith({ email })).resolves.toBe(false);
    expect(mocks.findUserIdByEmail).not.toHaveBeenCalled();
  });

  it('denies an email Google has not verified', async () => {
    await expect(signInWith({ verified: false })).resolves.toBe(false);
    expect(mocks.findUserIdByEmail).not.toHaveBeenCalled();
  });

  it('denies any provider other than Google', async () => {
    await expect(signInWith({ provider: 'github' })).resolves.toBe(false);
    expect(mocks.findUserIdByEmail).not.toHaveBeenCalled();
  });
});

describe('refreshAdminClaim', () => {
  const NOW = 10_000_000;

  it('copies is_admin into the token at sign-in', async () => {
    mocks.getUserAdminFlag.mockResolvedValue(true);
    const token = await refreshAdminClaim({ token: {}, user: { id: 'user_1' }, now: NOW });
    expect(token).toMatchObject({ sub: 'user_1', isAdmin: true, adminCheckedAt: NOW });
  });

  it('re-reads is_admin once the 5-minute TTL has passed', async () => {
    mocks.getUserAdminFlag.mockResolvedValue(false);
    const fresh = { sub: 'user_1', isAdmin: true, adminCheckedAt: NOW - ADMIN_CLAIM_TTL_MS + 1 };
    await expect(refreshAdminClaim({ token: { ...fresh }, now: NOW })).resolves.toMatchObject({
      isAdmin: true,
    });
    expect(mocks.getUserAdminFlag).not.toHaveBeenCalled();

    const stale = { ...fresh, adminCheckedAt: NOW - ADMIN_CLAIM_TTL_MS };
    await expect(refreshAdminClaim({ token: stale, now: NOW })).resolves.toMatchObject({
      isAdmin: false,
      adminCheckedAt: NOW,
    });
    expect(mocks.getUserAdminFlag).toHaveBeenCalledWith('user_1');
  });

  it('clears isAdmin and keeps the stale timestamp when the refresh fails', async () => {
    mocks.getUserAdminFlag.mockRejectedValue(new Error('db down'));
    const token = await refreshAdminClaim({
      token: { sub: 'user_1', isAdmin: true, adminCheckedAt: 1 },
      now: NOW,
    });
    expect(token).toMatchObject({ isAdmin: false, adminCheckedAt: 1 });
  });

  it('ends the session when the user row no longer exists', async () => {
    mocks.getUserAdminFlag.mockResolvedValue(null);
    await expect(
      refreshAdminClaim({ token: { sub: 'user_gone', isAdmin: true, adminCheckedAt: 0 }, now: NOW })
    ).resolves.toBeNull();
  });
});

describe('AUTH_ADMIN_EMAILS (#22 A06)', () => {
  const LISTED = 'listed-admin@example.test';
  const NOW = 10_000_000;

  beforeEach(() => {
    vi.stubEnv('AUTH_ADMIN_EMAILS', ` ${LISTED.toUpperCase()} , other@example.test`);
    mocks.grantUserAdmin.mockResolvedValue(undefined);
  });

  it('admits a verified listed email that has no seeded row, without a lookup', async () => {
    await expect(signInWith({ email: LISTED })).resolves.toBe(true);
    expect(mocks.findUserIdByEmail).not.toHaveBeenCalled();
  });

  it('denies a listed email Google has not verified', async () => {
    await expect(signInWith({ email: LISTED, verified: false })).resolves.toBe(false);
  });

  it('denies a listed email from a non-Google provider', async () => {
    await expect(signInWith({ email: LISTED, provider: 'github' })).resolves.toBe(false);
  });

  it('still denies an unlisted, unseeded email and a DB error for an unlisted email', async () => {
    await expect(signInWith({ email: 'stranger@example.test' })).resolves.toBe(false);
    mocks.findUserIdByEmail.mockRejectedValue(new Error('db down'));
    await expect(signInWith({ email: 'stranger@example.test' })).resolves.toBe(false);
  });

  it('grants nothing when the variable is unset', async () => {
    vi.stubEnv('AUTH_ADMIN_EMAILS', undefined);
    await expect(signInWith({ email: LISTED })).resolves.toBe(false);
    mocks.getUserAdminFlag.mockResolvedValue(false);
    const token = await refreshAdminClaim({
      token: {},
      user: { id: 'u1', email: LISTED },
      now: NOW,
    });
    expect(mocks.grantUserAdmin).not.toHaveBeenCalled();
    expect(token).toMatchObject({ isAdmin: false });
  });

  it('writes is_admin = true at sign-in, then reads it back from the DB', async () => {
    mocks.getUserAdminFlag.mockResolvedValue(true);
    const token = await refreshAdminClaim({
      token: {},
      user: { id: 'u1', email: LISTED },
      now: NOW,
    });
    expect(mocks.grantUserAdmin).toHaveBeenCalledWith('u1');
    expect(mocks.getUserAdminFlag).toHaveBeenCalledWith('u1');
    expect(token).toMatchObject({ sub: 'u1', isAdmin: true, adminCheckedAt: NOW });
  });

  it('clears isAdmin and leaves the check stale when the admin grant fails', async () => {
    mocks.grantUserAdmin.mockRejectedValue(new Error('db down'));
    mocks.getUserAdminFlag.mockResolvedValue(true);
    const token = await refreshAdminClaim({
      token: { isAdmin: true },
      user: { id: 'u1', email: LISTED },
      now: NOW,
    });
    expect(token).toMatchObject({ sub: 'u1', isAdmin: false, adminCheckedAt: 0 });
    expect(mocks.getUserAdminFlag).not.toHaveBeenCalled();
  });
});
