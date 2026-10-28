/** #22 (A06): AUTH_ADMIN_EMAILS parsing. Fixture emails use example.test only. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAdminEmails, isEnvAdminEmail } from '@/lib/auth-env';

afterEach(() => vi.unstubAllEnvs());

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
