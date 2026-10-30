/** #163: base URL normalization (trailing newline broke sitemap `<loc>` values). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBaseUrl, normalizeBaseUrl } from '@/lib/site-url';

describe('normalizeBaseUrl', () => {
  it.each([
    ['https://joanies.kitchen\n', 'https://joanies.kitchen'],
    ['  https://joanies.kitchen  ', 'https://joanies.kitchen'],
    ['https://joanies.kitchen/', 'https://joanies.kitchen'],
    ['https://joanies.kitchen//', 'https://joanies.kitchen'],
    ['https://joanies.kitchen/\n', 'https://joanies.kitchen'],
    ['', ''],
    [undefined, ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeBaseUrl(input)).toBe(expected);
  });
});

describe('getBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('cleans a trailing newline from NEXT_PUBLIC_APP_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.test\n');
    expect(getBaseUrl()).toBe('https://example.test');
  });

  it('uses the default fallback when the variable is blank', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '  \n');
    expect(getBaseUrl()).toBe('https://joanies.kitchen');
  });

  it('uses a caller-supplied fallback when the variable is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    expect(getBaseUrl('http://localhost:3002')).toBe('http://localhost:3002');
  });
});
