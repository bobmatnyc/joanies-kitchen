/**
 * Tdb: show recipe source (Bob 2026-11-09) — one case per prod `recipes.source` format.
 */
import { describe, expect, it } from 'vitest';
import {
  type RecipeSourceInput,
  resolvedExternalUrl,
  resolveRecipeSource,
} from '@/lib/recipes/recipe-source';

const SYSTEM = { isSystemRecipe: true, isAiGenerated: false };
const USER = { isSystemRecipe: false, isAiGenerated: false };
const CHEF = { slug: 'dan-barber', name: 'Dan Barber', display_name: 'Chef Dan Barber' };
const MEALDB = { name: 'TheMealDB', slug: 'themealdb', website_url: 'https://www.themealdb.com' };

function resolve(source: string | null, extra: Partial<RecipeSourceInput> = {}) {
  return resolveRecipeSource({ source, ...SYSTEM, ...extra });
}

describe('resolveRecipeSource', () => {
  it('a: chef via chef_id links to the chef page on this site', () => {
    expect(resolve('Dan Barber', { chef: CHEF })).toEqual({
      kind: 'chef',
      label: 'Chef Dan Barber',
      href: '/chef/dan-barber',
    });
  });

  it('a: chef plus a URL adds an "original on <host>" secondary link', () => {
    const r = resolve('https://www.seriouseats.com/x', { chef: { ...CHEF, display_name: null } });
    expect(r).toEqual({
      kind: 'chef',
      label: 'Dan Barber',
      href: '/chef/dan-barber',
      secondary: { label: 'original on seriouseats.com', href: 'https://www.seriouseats.com/x' },
    });
  });

  it('a: chef known only through chef_recipes uses its original_url', () => {
    const r = resolve('system', { chef: CHEF, chefOriginalUrl: 'https://bluehill.com/r/1' });
    expect(r?.kind).toBe('chef');
    expect(r?.secondary).toEqual({
      label: 'original on bluehill.com',
      href: 'https://bluehill.com/r/1',
    });
  });

  it('b: a bare domain links to the site root', () => {
    expect(resolve('epicurious.com')).toEqual({
      kind: 'site',
      label: 'epicurious.com',
      href: 'https://epicurious.com/',
    });
  });

  it('b: a bare domain with a path links to https://<host>/<path>', () => {
    expect(resolve('food.com/recipe/154576')).toEqual({
      kind: 'site',
      label: 'food.com',
      href: 'https://food.com/recipe/154576',
    });
  });

  it('b: a full URL is labelled by host, with www. stripped', () => {
    expect(resolve('https://www.bonappetit.com/recipe/soup')).toEqual({
      kind: 'site',
      label: 'bonappetit.com',
      href: 'https://www.bonappetit.com/recipe/soup',
    });
  });

  it('b: query string and fragment never reach the label', () => {
    const r = resolve('http://www.example.com/r?id=7&utm=x#step-2');
    expect(r?.label).toBe('example.com');
    expect(r?.href).toBe('http://www.example.com/r?id=7&utm=x#step-2');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://files.example.com/recipe.txt',
  ])('b: %s is never a link', (source) => {
    const r = resolve(source);
    expect(r?.href).toBeUndefined();
    expect(r?.secondary).toBeUndefined();
    expect(resolvedExternalUrl(r)).toBeUndefined();
  });

  it('b: a non-http chef original_url is never the secondary link', () => {
    const r = resolve(null, { chef: CHEF, chefOriginalUrl: 'javascript:alert(1)' });
    expect(r?.secondary).toBeUndefined();
  });

  it('c: TheMealDB id with a source row links to the source website', () => {
    expect(resolve('TheMealDB (ID: 53028)', { site: MEALDB })).toEqual({
      kind: 'themealdb',
      label: 'TheMealDB',
      href: 'https://www.themealdb.com/',
    });
  });

  it('c: a non-http website_url is not linked', () => {
    const r = resolve('TheMealDB (ID: 1)', { site: { ...MEALDB, website_url: 'data:x' } });
    expect(r).toEqual({ kind: 'themealdb', label: 'TheMealDB' });
  });

  it('d: person or title text is plain text', () => {
    expect(resolve('Amanda Hesser / The New York Times')).toEqual({
      kind: 'text',
      label: 'Amanda Hesser / The New York Times',
    });
  });

  it.each(["Joanie's Sunday Lunch - Roast Chicken", "Joanie's Kitchen - Original Recipe"])(
    'e: "%s" is first-party with no link',
    (source) => {
      expect(resolve(source)).toEqual({ kind: 'first-party', label: "Joanie's Kitchen" });
    }
  );

  it.each([
    'system',
    'Recipe Manager Team',
    'RECIPE MANAGER TEAM',
    'Forked from recipe ID: abc',
    null,
    '',
    '   ',
  ])('f: %s on a system recipe renders nothing', (source) => {
    expect(resolve(source)).toBeNull();
  });

  it('g: a user recipe with a public profile links to the profile', () => {
    const r = resolveRecipeSource({
      source: null,
      ...USER,
      author: { isPublic: true, username: 'joanie', display_name: 'Joanie' },
    });
    expect(r).toEqual({ kind: 'user', label: 'Added by Joanie', href: '/profile/joanie' });
  });

  it('g: a user recipe with a private profile names no one and links nowhere', () => {
    const r = resolveRecipeSource({
      source: 'Forked from recipe ID: abc',
      ...USER,
      author: { isPublic: false },
    });
    expect(r).toEqual({ kind: 'user', label: 'Shared by a community member' });
  });

  it('g: an external source on a user recipe still wins (rule b)', () => {
    const r = resolveRecipeSource({
      source: 'epicurious.com',
      ...USER,
      author: { isPublic: false },
    });
    expect(r?.kind).toBe('site');
  });

  it('h: an AI recipe with nothing else known renders nothing', () => {
    expect(
      resolveRecipeSource({ source: null, isSystemRecipe: false, isAiGenerated: true })
    ).toBeNull();
  });
});
