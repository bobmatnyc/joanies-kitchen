/** #60 D5f: the local-staging auth bypass predicate must fail closed everywhere but local staging. */
import { describe, expect, it } from 'vitest';
import { isLocalStagingAuthBypassActive, localStagingAuthEmail } from '@/lib/local-staging-auth';

// Fake URL shapes only (no password); fixture email uses example.test.
const dbUrl = (host: string) => `postgres://u@${host}:5432/db`;
const ACTIVE = {
  LOCAL_STAGING_AUTH_BYPASS: '1',
  LOCAL_STAGING_AUTH_EMAIL: ' Staging@Example.TEST ',
  DATABASE_URL: dbUrl('127.0.0.1'),
};

describe('localStagingAuthEmail (#60 D5f)', () => {
  it.each(['127.0.0.1', 'localhost', '[::1]'])('is active for loopback host %s', (host) => {
    const env = { ...ACTIVE, DATABASE_URL: dbUrl(host) };
    expect(localStagingAuthEmail(env)).toBe('staging@example.test');
    expect(isLocalStagingAuthBypassActive(env)).toBe(true);
  });

  it.each<[string, Record<string, string | undefined>]>([
    ['flag unset', { ...ACTIVE, LOCAL_STAGING_AUTH_BYPASS: undefined }],
    ['flag empty', { ...ACTIVE, LOCAL_STAGING_AUTH_BYPASS: '' }],
    ['flag "true"', { ...ACTIVE, LOCAL_STAGING_AUTH_BYPASS: 'true' }],
    ['flag "yes"', { ...ACTIVE, LOCAL_STAGING_AUTH_BYPASS: 'yes' }],
    ['flag "0"', { ...ACTIVE, LOCAL_STAGING_AUTH_BYPASS: '0' }],
    ['flag " 1"', { ...ACTIVE, LOCAL_STAGING_AUTH_BYPASS: ' 1' }],
    ['Neon host', { ...ACTIVE, DATABASE_URL: dbUrl('ep-x-123.us-east-1.aws.neon.tech') }],
    ['localhost.evil.com', { ...ACTIVE, DATABASE_URL: dbUrl('localhost.evil.com') }],
    ['127.0.0.1.nip.io', { ...ACTIVE, DATABASE_URL: dbUrl('127.0.0.1.nip.io') }],
    ['loopback only in the path', { ...ACTIVE, DATABASE_URL: 'postgres://u@neon.tech/127.0.0.1' }],
    ['DATABASE_URL unset', { ...ACTIVE, DATABASE_URL: undefined }],
    ['unparseable DATABASE_URL', { ...ACTIVE, DATABASE_URL: 'not a url' }],
    ['loopback plus VERCEL=1', { ...ACTIVE, VERCEL: '1' }],
    ['loopback plus VERCEL=""', { ...ACTIVE, VERCEL: '' }],
    ['loopback plus VERCEL_ENV=production', { ...ACTIVE, VERCEL_ENV: 'production' }],
    ['loopback plus VERCEL_ENV=preview', { ...ACTIVE, VERCEL_ENV: 'preview' }],
    ['loopback plus VERCEL_URL', { ...ACTIVE, VERCEL_URL: 'x.vercel.app' }],
    ['email unset', { ...ACTIVE, LOCAL_STAGING_AUTH_EMAIL: undefined }],
    ['email blank', { ...ACTIVE, LOCAL_STAGING_AUTH_EMAIL: '   ' }],
    ['email without @', { ...ACTIVE, LOCAL_STAGING_AUTH_EMAIL: 'staging' }],
    ['empty env', {}],
  ])('is inactive when %s', (_label, env) => {
    expect(localStagingAuthEmail(env)).toBeUndefined();
    expect(isLocalStagingAuthBypassActive(env)).toBe(false);
  });

  it('is inactive (fails closed) when reading the env throws', () => {
    const throwing = new Proxy(
      {},
      {
        get() {
          throw new Error('env read failed');
        },
      }
    ) as Record<string, string | undefined>;
    expect(isLocalStagingAuthBypassActive(throwing)).toBe(false);
  });
});
