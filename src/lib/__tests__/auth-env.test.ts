/** #22 (A06): AUTH_ADMIN_EMAILS parsing. Fixture emails use example.test only. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAdminEmails, isAuthConfigured, isEnvAdminEmail } from '@/lib/auth-env';

afterEach(() => vi.unstubAllEnvs());

/** #154: Auth.js is off on Vercel previews; any other VERCEL_ENV keeps the env-var check. */
describe('isAuthConfigured and VERCEL_ENV', () => {
  function stubAuthVars(set: boolean) {
    vi.stubEnv('AUTH_SECRET', set ? 'test-secret' : '');
    vi.stubEnv('AUTH_GOOGLE_ID', set ? 'test-id' : '');
    vi.stubEnv('AUTH_GOOGLE_SECRET', set ? 'test-google-secret' : '');
  }

  it.each([
    ['preview', 'preview', false],
    ['production', 'production', true],
    ['unset', undefined, true],
    ['an unknown value', 'staging', true],
  ])('with all AUTH vars set and VERCEL_ENV %s', (_label, vercelEnv, expected) => {
    stubAuthVars(true);
    vi.stubEnv('VERCEL_ENV', vercelEnv);
    expect(isAuthConfigured()).toBe(expected);
  });

  it('is false in production when an AUTH var is missing', () => {
    stubAuthVars(true);
    vi.stubEnv('AUTH_GOOGLE_SECRET', '');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(isAuthConfigured()).toBe(false);
  });
});

describe('AUTH_ADMIN_EMAILS', () => {
  it('trims and lower-cases each entry and matches case-insensitively', () => {
    vi.stubEnv('AUTH_ADMIN_EMAILS', ' One@Example.TEST , two@example.test,');
    expect(getAdminEmails()).toEqual(['one@example.test', 'two@example.test']);
    expect(isEnvAdminEmail('  ONE@example.test ')).toBe(true);
    expect(isEnvAdminEmail('three@example.test')).toBe(false);
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ['separators only', ' , ,, '],
  ])('grants nothing when %s', (_label, value) => {
    vi.stubEnv('AUTH_ADMIN_EMAILS', value);
    expect(getAdminEmails()).toEqual([]);
    expect(isEnvAdminEmail('one@example.test')).toBe(false);
    expect(isEnvAdminEmail('')).toBe(false);
  });
});
