/**
 * #60 D5f: with the bypass inactive the provider list is Google only; when
 * active, the extra Credentials provider authorizes only the configured email.
 */
import type { User } from 'next-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUserIdByEmail: vi.fn(),
  findPendingDeletionByEmail: vi.fn(),
}));

vi.mock('@/lib/auth-users', () => ({
  normalizeEmail: (e: string | null | undefined) => e?.trim().toLowerCase() || null,
  findUserIdByEmail: mocks.findUserIdByEmail,
  findPendingDeletionByEmail: mocks.findPendingDeletionByEmail,
}));

import { authConfig } from '@/auth.config';
import { isAuthConfigured } from '@/lib/auth-env';
import {
  authorizeLocalStagingSignIn,
  authorizeLocalStagingUser,
  buildAuthProviders,
  gateLocalStagingToken,
} from '@/lib/local-staging-auth-provider';

const EMAIL = 'staging@example.test';
const ACTIVE = {
  LOCAL_STAGING_AUTH_BYPASS: '1',
  LOCAL_STAGING_AUTH_EMAIL: EMAIL,
  DATABASE_URL: 'postgres://u@127.0.0.1:5432/db',
};
const INACTIVE_ENVS: Record<string, string | undefined>[] = [
  {},
  { ...ACTIVE, LOCAL_STAGING_AUTH_BYPASS: undefined },
  { ...ACTIVE, DATABASE_URL: 'postgres://u@ep-x.us-east-1.aws.neon.tech/db' },
  { ...ACTIVE, VERCEL: '1' },
  { ...ACTIVE, VERCEL_ENV: 'production' },
  { ...ACTIVE, LOCAL_STAGING_AUTH_EMAIL: undefined },
];

/** Auth.js keeps user-supplied provider options under `options` until it parses them. */
type ProviderLike = {
  id: string;
  options?: { id?: string; authorize?: (c: unknown, r: unknown) => Promise<User | null> };
};
const effectiveId = (p: unknown) => {
  const provider = p as ProviderLike;
  return provider.options?.id ?? provider.id;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findPendingDeletionByEmail.mockResolvedValue(null);
  mocks.findUserIdByEmail.mockResolvedValue('user_staging');
});
afterEach(() => vi.unstubAllEnvs());

describe('buildAuthProviders (#60 D5f)', () => {
  it.each(INACTIVE_ENVS)('is exactly the Google-only edge list when inactive (%o)', (env) => {
    const providers = buildAuthProviders(env);
    expect(providers).toBe(authConfig.providers);
    expect(providers.map(effectiveId)).toEqual(['google']);
  });

  it('appends the local-staging Credentials provider when active', () => {
    expect(buildAuthProviders(ACTIVE).map(effectiveId)).toEqual(['google', 'local-staging']);
  });

  it('the provider authorizes the configured email and ignores submitted input', async () => {
    const provider = buildAuthProviders(ACTIVE)[1] as unknown as ProviderLike;
    const user = await provider.options?.authorize?.({ email: 'other@example.test' }, {});
    expect(user).toEqual({ id: 'user_staging', email: EMAIL });
    expect(mocks.findUserIdByEmail).toHaveBeenCalledWith(EMAIL);
    expect(mocks.findUserIdByEmail).toHaveBeenCalledTimes(1);
  });
});

describe('authorizeLocalStagingUser (#60 D5f)', () => {
  it.each(INACTIVE_ENVS)('returns null without a DB read when inactive (%o)', async (env) => {
    expect(await authorizeLocalStagingUser(env)).toBeNull();
    expect(mocks.findUserIdByEmail).not.toHaveBeenCalled();
  });

  it('returns null for an unseeded email', async () => {
    mocks.findUserIdByEmail.mockResolvedValue(null);
    expect(await authorizeLocalStagingUser(ACTIVE)).toBeNull();
  });

  it('returns null for a pending account deletion (#103)', async () => {
    mocks.findPendingDeletionByEmail.mockResolvedValue({ userId: 'user_staging' });
    expect(await authorizeLocalStagingUser(ACTIVE)).toBeNull();
  });

  it('returns null on a DB error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.findUserIdByEmail.mockRejectedValue(new Error('db down'));
    expect(await authorizeLocalStagingUser(ACTIVE)).toBeNull();
  });
});

describe('authorizeLocalStagingSignIn (#60 D5f)', () => {
  const account = {
    provider: 'local-staging',
    type: 'credentials',
    providerAccountId: 'x',
  } as const;

  it('admits only the configured email from the bypass provider while active', () => {
    expect(authorizeLocalStagingSignIn({ user: { email: EMAIL }, account }, ACTIVE)).toBe(true);
    expect(
      authorizeLocalStagingSignIn({ user: { email: 'other@example.test' }, account }, ACTIVE)
    ).toBe(false);
    expect(
      authorizeLocalStagingSignIn(
        { user: { email: EMAIL }, account: { ...account, provider: 'google' } },
        ACTIVE
      )
    ).toBe(false);
  });

  it.each(INACTIVE_ENVS)('refuses every login when inactive (%o)', (env) => {
    expect(authorizeLocalStagingSignIn({ user: { email: EMAIL }, account }, env)).toBe(false);
  });
});

describe('gateLocalStagingToken (#60 D5f)', () => {
  const stagingAccount = {
    provider: 'local-staging',
    type: 'credentials',
    providerAccountId: 'x',
  } as const;

  it('marks a token minted by the bypass provider', () => {
    const token = gateLocalStagingToken({ token: { sub: 'u' }, account: stagingAccount }, ACTIVE);
    expect(token).toEqual({ sub: 'u', localStaging: true });
  });

  it('accepts a marked token while the bypass is active', () => {
    const token = { sub: 'u', localStaging: true };
    expect(gateLocalStagingToken({ token }, ACTIVE)).toBe(token);
  });

  it.each(INACTIVE_ENVS)('ends the session for a marked token when inactive (%o)', (env) => {
    expect(gateLocalStagingToken({ token: { sub: 'u', localStaging: true } }, env)).toBeNull();
  });

  it.each([ACTIVE, ...INACTIVE_ENVS])('leaves an unmarked token unchanged (%o)', (env) => {
    const token = { sub: 'u', isAdmin: true };
    const google = { provider: 'google', type: 'oidc', providerAccountId: 'g' } as const;
    expect(gateLocalStagingToken({ token }, env)).toBe(token);
    expect(gateLocalStagingToken({ token, account: google }, env)).toEqual({
      sub: 'u',
      isAdmin: true,
    });
  });
});

describe('isAuthConfigured with the bypass (#60 D5f)', () => {
  it('stays false without Google credentials when the bypass is inactive', () => {
    vi.stubEnv('AUTH_SECRET', 's');
    vi.stubEnv('AUTH_GOOGLE_ID', '');
    vi.stubEnv('AUTH_GOOGLE_SECRET', '');
    vi.stubEnv('LOCAL_STAGING_AUTH_BYPASS', '1');
    vi.stubEnv('LOCAL_STAGING_AUTH_EMAIL', EMAIL);
    vi.stubEnv('DATABASE_URL', ACTIVE.DATABASE_URL);
    vi.stubEnv('VERCEL', '1');
    expect(isAuthConfigured()).toBe(false);
  });

  it('is true without Google credentials when the bypass is active and AUTH_SECRET is set', () => {
    vi.stubEnv('AUTH_SECRET', 's');
    vi.stubEnv('AUTH_GOOGLE_ID', '');
    vi.stubEnv('AUTH_GOOGLE_SECRET', '');
    for (const [k, v] of Object.entries(ACTIVE)) vi.stubEnv(k, v);
    for (const k of ['VERCEL', 'VERCEL_ENV', 'VERCEL_URL']) vi.stubEnv(k, undefined);
    expect(isAuthConfigured()).toBe(true);
    vi.stubEnv('AUTH_SECRET', '');
    expect(isAuthConfigured()).toBe(false);
  });
});
