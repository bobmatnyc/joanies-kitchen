// @vitest-environment node
/**
 * #135: the pure duplicate-detection helpers. Every canonicalisation rule has a
 * row, and the "must NOT collapse" rows guard against an over-eager rule.
 */

import { describe, expect, it } from 'vitest';
import {
  canonicalizeSourceUrl,
  matchDuplicate,
  normalizeRecipeTitle,
  sourceHost,
} from '@/lib/recipes/dedup';

describe('normalizeRecipeTitle', () => {
  it.each([
    ['lowercases', 'Chicken SOUP', 'chicken soup'],
    ['strips accents', 'Crème Brûlée', 'creme brulee'],
    ['drops straight and curly apostrophes', "Grandma's Mom’s Pie", 'grandmas moms pie'],
    ['turns other punctuation into spaces', 'Mac-and-Cheese: Baked!', 'mac and cheese baked'],
    ['collapses whitespace and trims', '  Beef \t  Stew \n', 'beef stew'],
    ['trims a trailing space (the Epicurious case)', 'Lentil Salad ', 'lentil salad'],
    ['keeps digits', '3-Bean Chili', '3 bean chili'],
    ['returns empty for null', null, ''],
  ])('%s', (_rule, input, expected) => {
    expect(normalizeRecipeTitle(input)).toBe(expected);
  });
});

describe('canonicalizeSourceUrl', () => {
  const base = 'https://example.com/recipes/soup';
  it.each([
    ['lowercases the host and drops www.', 'https://WWW.Example.COM/recipes/soup', base],
    ['forces https', 'http://example.com/recipes/soup', base],
    ['drops the fragment', 'https://example.com/recipes/soup#comments', base],
    [
      'drops utm_*, fbclid and gclid',
      'https://example.com/recipes/soup?utm_source=x&UTM_Medium=y&fbclid=1&gclid=2',
      base,
    ],
    [
      'sorts the remaining params',
      'https://example.com/r?b=2&a=1&a=0',
      'https://example.com/r?a=0&a=1&b=2',
    ],
    ['strips a trailing slash', 'https://example.com/recipes/soup/', base],
    ['strips a trailing /print/', 'https://example.com/recipes/soup/print/', base],
    ['strips a trailing /print', 'https://example.com/recipes/soup/print', base],
    ['strips comment-page-N', 'https://example.com/recipes/soup/comment-page-3/', base],
    [
      'strips stacked view segments',
      'https://www.example.com/recipes/soup/comment-page-2/print/#x',
      base,
    ],
    ['keeps the bare host without a slash', 'https://example.com/', 'https://example.com'],
    ['keeps a non-default port', 'http://example.com:8080/a/', 'https://example.com:8080/a'],
    ['drops http port 80', 'http://example.com:80/a', 'https://example.com/a'],
    ['trims surrounding whitespace', '  https://example.com/recipes/soup  ', base],
  ])('%s', (_rule, input, expected) => {
    expect(canonicalizeSourceUrl(input)).toBe(expected);
  });

  it.each([
    ['not a URL', 'chicken soup'],
    ['a scheme-less host', 'example.com/recipes/soup'],
    ['a non-http scheme', 'ftp://example.com/soup'],
    ['empty', ''],
    ['null', null],
  ])('returns null for %s', (_label, input) => {
    expect(canonicalizeSourceUrl(input)).toBeNull();
  });

  it.each([
    ['different paths on one host', 'https://example.com/soup', 'https://example.com/stew'],
    ['path case', 'https://example.com/Soup', 'https://example.com/soup'],
    ['a non-tracking param', 'https://example.com/r?id=1', 'https://example.com/r?id=2'],
    ['print in the middle of a path', 'https://example.com/print/soup', 'https://example.com/soup'],
    ['a bare /print path', 'https://example.com/print', 'https://example.com'],
    ['a subdomain other than www', 'https://blog.example.com/soup', 'https://example.com/soup'],
    ['a different port', 'https://example.com:8443/soup', 'https://example.com/soup'],
  ])('does NOT collapse %s', (_label, a, b) => {
    expect(canonicalizeSourceUrl(a)).not.toBe(canonicalizeSourceUrl(b));
  });
});

describe('sourceHost', () => {
  it('returns the lowercased host without www.', () => {
    expect(sourceHost('http://WWW.Food.com/x')).toBe('food.com');
    expect(sourceHost('not a url')).toBeNull();
  });
});

describe('matchDuplicate', () => {
  const BG = { titleRule: true };
  const rows = [
    { id: 'r1', name: 'Chicken Soup', source: 'https://www.a.com/chicken-soup/' },
    { id: 'r2', name: 'Beef Stew', source: 'https://b.com/stew' },
    { id: 'r3', name: 'No Source', source: null },
  ];

  it('matches a URL variant of a stored source', () => {
    const m = matchDuplicate({ sourceUrl: 'http://a.com/chicken-soup/print/#top' }, rows, BG);
    expect(m).toMatchObject({ id: 'r1', reason: 'source-url' });
  });

  it('matches the same normalised title on the same host', () => {
    const m = matchDuplicate(
      { sourceUrl: 'https://a.com/other', title: 'chicken  soup!' },
      rows,
      BG
    );
    expect(m).toMatchObject({ id: 'r1', reason: 'title-and-host' });
  });

  it('with titleRule off, matches only the canonical URL (user imports)', () => {
    const user = { titleRule: false };
    expect(
      matchDuplicate({ sourceUrl: 'https://a.com/other', title: 'Chicken Soup' }, rows, user)
    ).toBeNull();
    expect(
      matchDuplicate({ sourceUrl: 'https://a.com/chicken-soup', title: 'x' }, rows, user)
    ).toMatchObject({ id: 'r1', reason: 'source-url' });
  });

  it('does NOT match the same title on another host', () => {
    expect(
      matchDuplicate({ sourceUrl: 'https://c.com/x', title: 'Chicken Soup' }, rows, BG)
    ).toBeNull();
  });

  it('prefers a URL match over an earlier title match', () => {
    const both = [
      { id: 'old', name: 'Stew', source: 'https://b.com/old-stew' },
      { id: 'url', name: 'Other', source: 'https://b.com/stew' },
    ];
    const m = matchDuplicate({ sourceUrl: 'https://b.com/stew/', title: 'Stew' }, both, BG);
    expect(m).toMatchObject({ id: 'url', reason: 'source-url' });
  });

  it('never matches without a usable candidate URL or on an empty title', () => {
    expect(matchDuplicate({ sourceUrl: null, title: 'Chicken Soup' }, rows, BG)).toBeNull();
    expect(matchDuplicate({ sourceUrl: 'https://a.com/x', title: '!!' }, rows, BG)).toBeNull();
  });
});
