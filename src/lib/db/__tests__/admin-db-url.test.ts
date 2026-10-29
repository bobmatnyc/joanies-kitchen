/**
 * D3a: admin DB tools use the unpooled Neon host only. Every case here fails
 * against the old substring check `*ep-jolly-snow-addxski4*`.
 */
import { describe, expect, it } from 'vitest';
import {
  AdminDbUrlError,
  adminDbUrl,
  assertProdHost,
  assertUnpooledHost,
  isPooledHost,
  PROD_HOST_REGEX,
  toUnpooledUrl,
} from '../admin-db-url';

const SECRET = 'dummyTestPw42';
const USER = 'neondb_owner';
const PROD = `ep-jolly-snow-addxski4.c-2.us-east-1.aws.neon.tech`;
const POOLED = `ep-jolly-snow-addxski4-pooler.c-2.us-east-1.aws.neon.tech`;
const url = (host: string) => `postgresql://${USER}:${SECRET}@${host}/neondb?sslmode=require`;

/** Runs fn, returns the thrown message; fails the test if nothing throws. */
function thrownMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AdminDbUrlError);
    return (e as Error).message;
  }
  throw new Error('expected a throw');
}

describe('toUnpooledUrl', () => {
  it('strips -pooler from the endpoint label and keeps the rest', () => {
    expect(toUnpooledUrl(url(POOLED))).toBe(url(PROD));
  });

  it('leaves an unpooled host unchanged', () => {
    expect(toUnpooledUrl(url(PROD))).toBe(url(PROD));
  });
});

describe('pooled host refusal', () => {
  it.each(['dump', 'ddl'] as const)('refuses a pooled host for %s', (purpose) => {
    expect(isPooledHost(url(POOLED))).toBe(true);
    expect(() => assertUnpooledHost(url(POOLED), purpose)).toThrow(/-pooler/);
    expect(() => adminDbUrl(url(POOLED), purpose)).toThrow(/-pooler/);
  });

  it('accepts the unpooled prod host', () => {
    expect(adminDbUrl(url(PROD), 'dump')).toBe(url(PROD));
  });
});

describe('anchored prod regex', () => {
  it('accepts the unpooled prod host', () => {
    expect(PROD_HOST_REGEX.test(PROD)).toBe(true);
    expect(() => assertProdHost(url(PROD))).not.toThrow();
  });

  it.each([
    ['pooled host', POOLED],
    ['lookalike suffix', 'ep-jolly-snow-addxski4.c-2.us-east-1.aws.neon.tech.evil.com'],
    ['lookalike label', 'ep-jolly-snow-addxski4x.c-2.us-east-1.aws.neon.tech'],
    ['substring match', 'evil-ep-jolly-snow-addxski4.c-2.us-east-1.aws.neon.tech'],
    ['substring in subdomain', 'ep-jolly-snow-addxski4.attacker.example.com'],
  ])('rejects a %s', (_name, host) => {
    expect(PROD_HOST_REGEX.test(host)).toBe(false);
    expect(() => assertProdHost(url(host))).toThrow(AdminDbUrlError);
  });

  it('adminDbUrl rejects a lookalike prod host even when it is unpooled', () => {
    const host = 'ep-jolly-snow-addxski4.aws.neon.tech.evil.com';
    expect(() => adminDbUrl(url(host), 'ddl')).toThrow(AdminDbUrlError);
  });

  it('adminDbUrl with { prod: true } rejects a non-prod host', () => {
    expect(() =>
      adminDbUrl(url('ep-bold-credit-1.us-east-1.aws.neon.tech'), 'dump', { prod: true })
    ).toThrow(AdminDbUrlError);
  });
});

describe('credentials never in error messages', () => {
  it.each([
    ['pooled refusal', () => adminDbUrl(url(POOLED), 'dump')],
    ['prod regex refusal', () => assertProdHost(url('ep-jolly-snow-addxski4.evil.com'))],
    ['unparseable string', () => adminDbUrl(`not a url ${SECRET}`, 'ddl')],
    ['wrong protocol', () => adminDbUrl(`mysql://${USER}:${SECRET}@${PROD}/db`, 'ddl')],
  ])('%s', (_name, fn) => {
    const message = thrownMessage(fn);
    expect(message).not.toContain(SECRET);
    expect(message).not.toContain(USER);
    expect(message).not.toContain(POOLED);
  });
});
