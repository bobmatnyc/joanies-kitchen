/**
 * #135 (code-critic HIGH): every refusal arm of the dedup-135 flag parser and
 * target choice. A missing, empty or unknown flag must stop the script; it
 * must never fall back to prod.
 */
import { describe, expect, it } from 'vitest';
import {
  ArgError,
  envTargetUrl,
  parseArgs,
  TARGET_FLAGS,
  targetChoice,
} from '../../../../scripts/dedup-135/args';

const SPEC = { ...TARGET_FLAGS, '--batch-id': 'value', '--dry': 'bool' } as const;
const parse = (...argv: string[]) => parseArgs(argv, SPEC);
/** Dummy URL built from parts, so no source line is a credentialed literal (check-secrets). */
function dbUrl(host: string): string {
  const url = new URL('postgresql://localhost/neondb');
  url.hostname = host;
  url.username = 'u';
  url.password = 'p';
  return url.toString();
}
const NON_PROD = dbUrl('ep-quiet-branch-123456.us-east-2.aws.neon.tech');
// The real prod endpoint label, so the prod-host refusal is exercised.
const PROD = dbUrl('ep-jolly-snow-addxski4.c-2.us-east-1.aws.neon.tech');

describe('parseArgs', () => {
  it('accepts known flags', () => {
    const a = parse('--batch-id', 'b1', '--dry', '--target', 'prod');
    expect([a.get('--batch-id'), a.has('--dry'), a.get('--target')]).toEqual(['b1', true, 'prod']);
  });

  it.each<[string, string[], RegExp]>([
    ['an unknown flag (--dry-run for --dry)', ['--dry-run'], /unknown flag --dry-run/],
    ['a stray argument', ['prod'], /unexpected argument "prod"/],
    [
      'a value flag given last',
      ['--dry', '--target-url-env'],
      /--target-url-env needs a non-empty value/,
    ],
    [
      'a value flag followed by a flag',
      ['--target-url-env', '--dry'],
      /--target-url-env needs a non-empty value/,
    ],
    ['an empty value', ['--target-url-env', ''], /--target-url-env needs a non-empty value/],
    ['a repeated flag', ['--dry', '--dry'], /--dry given twice/],
  ])('refuses %s', (_label, argv, expected) => {
    expect(() => parse(...argv)).toThrow(ArgError);
    expect(() => parse(...argv)).toThrow(expected);
  });
});

describe('targetChoice', () => {
  it('needs a target for apply and rollback', () => {
    expect(() => targetChoice(parse('--batch-id', 'b'), { required: true })).toThrow(
      /a target is required/
    );
  });
  it('read-only callers may default to prod', () => {
    expect(targetChoice(parse(), { required: false })).toEqual({ kind: 'prod' });
  });
  it('refuses both targets at once', () => {
    expect(() =>
      targetChoice(parse('--target', 'prod', '--target-url-env', 'X'), { required: true })
    ).toThrow(/not both/);
  });
  it('refuses a --target other than prod', () => {
    expect(() => targetChoice(parse('--target', 'staging'), { required: true })).toThrow(
      /--target accepts only "prod"/
    );
  });
  it('returns the explicit choice', () => {
    expect(targetChoice(parse('--target', 'prod'), { required: true })).toEqual({ kind: 'prod' });
    expect(targetChoice(parse('--target-url-env', 'STAGE'), { required: true })).toEqual({
      kind: 'env',
      name: 'STAGE',
    });
  });
});

describe('envTargetUrl', () => {
  it('returns a non-prod unpooled URL', () => {
    expect(envTargetUrl('STAGE', { STAGE: NON_PROD })).toBe(NON_PROD);
  });
  it.each<[string, Record<string, string | undefined>, RegExp]>([
    ['an unset variable', {}, /STAGE: variable is not set or empty/],
    ['an empty variable', { STAGE: ' ' }, /STAGE: variable is not set or empty/],
    ['a prod-host URL', { STAGE: PROD }, /names the prod endpoint/],
    ['a pooled host', { STAGE: NON_PROD.replace('123456', '123456-pooler') }, /-pooler/],
  ])('refuses %s', (_label, env, expected) => {
    expect(() => envTargetUrl('STAGE', env)).toThrow(expected);
  });
});
