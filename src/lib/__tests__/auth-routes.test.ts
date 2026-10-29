/** #22: edge middleware route rules and the post-sign-in redirect guard. */
import { describe, expect, it } from 'vitest';
import { decideRoute, safeCallbackPath } from '@/lib/auth-routes';

const ANON = { userId: null, isAdmin: false };
const USER = { userId: 'u1', isAdmin: false };
const ADMIN = { userId: 'u1', isAdmin: true };

describe('decideRoute', () => {
  it.each([
    ['/admin', ANON, 'sign-in'],
    ['/admin/crawl-monitor', USER, 'home'],
    ['/admin/crawl-monitor', ADMIN, 'allow'],
    ['/recipes/new', ANON, 'sign-in'],
    ['/recipes', ANON, 'allow'],
    ['/recipes', USER, 'allow'],
    ['/recipes/edit/abc', ANON, 'sign-in'],
    ['/recipes/edit', ANON, 'sign-in'],
    ['/meals/new', ANON, 'sign-in'],
    ['/meal-plans', ANON, 'sign-in'],
    ['/recipes/new', USER, 'allow'],
    ['/api/meal-plans/1', ANON, 'unauthorized'],
    ['/api/recipes/create', ANON, 'unauthorized'],
    ['/recipes/some-slug', ANON, 'allow'],
    ['/meals/some-slug', ANON, 'allow'],
    ['/', ANON, 'allow'],
    ['/sign-in', ANON, 'allow'],
    ['/api/auth/callback/google', ANON, 'allow'],
    ['/privacy', ANON, 'allow'],
    ['/terms', ANON, 'allow'],
  ] as const)('%s for %o → %s', (path, session, expected) => {
    expect(decideRoute(path, session)).toBe(expected);
  });
});

describe('safeCallbackPath', () => {
  it.each([
    ['/favorites', '/favorites'],
    ['/admin?x=1', '/admin?x=1'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    [undefined, '/'],
    [['/a', '/b'], '/'],
  ] as const)('%o → %s', (input, expected) => {
    expect(safeCallbackPath(input as string | string[] | undefined)).toBe(expected);
  });
});
