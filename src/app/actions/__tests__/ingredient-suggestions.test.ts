/**
 * #47: home search autocomplete ranks exact/prefix matches above substring
 * matches, never repeats an ingredient, and never labels a stock as Dairy.
 * The DB is stubbed so these test the server action's own post-processing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; name: string; displayName: string; category: string | null; isCommon: boolean };

const mocks = vi.hoisted(() => ({ rows: [] as Row[] }));

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/cache', () => ({
  ENABLE_CACHE_STATS: false,
  generateIngredientSearchKey: () => 'k',
  generateIngredientSuggestionsKey: () => 'k',
  generatePopularIngredientsKey: () => 'k',
  searchCaches: { ingredientSuggestions: { get: () => undefined, set: () => undefined } },
}));
vi.mock('@/lib/db', () => {
  // Every query returns the fixture rows in DB order (is_common, name), as
  // origin/main's ORDER BY does; the action must do the ranking itself.
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => mocks.rows,
  };
  return { db: chain };
});

import { getIngredientSuggestions } from '@/app/actions/ingredient-search';

const row = (id: string, displayName: string, category: string | null, isCommon = true): Row => ({
  id,
  name: displayName.toLowerCase().replace(/ /g, '-'),
  displayName,
  category,
  isCommon,
});

async function names(query: string, limit = 8): Promise<string[]> {
  const result = await getIngredientSuggestions(query, { limit });
  expect(result.success).toBe(true);
  return result.suggestions.map((s) => s.displayName);
}

describe('getIngredientSuggestions (#47)', () => {
  beforeEach(() => {
    mocks.rows = [];
  });

  it('ranks exact, then prefix, then substring matches', async () => {
    mocks.rows = [
      row('1', 'Beef or Chicken Stock', 'dairy'),
      row('2', 'Chicken Breast', 'proteins'),
      row('3', 'Frying Chicken', 'proteins'),
      row('4', 'Chicken', 'proteins'),
    ];
    const got = await names('chicken');
    expect(got[0]).toBe('Chicken');
    expect(got[1]).toBe('Chicken Breast');
    expect(got.indexOf('Chicken Breast')).toBeLessThan(got.indexOf('Frying Chicken'));
    expect(got.indexOf('Chicken Breast')).toBeLessThan(got.indexOf('Beef or Chicken Stock'));
  });

  it('drops duplicates that differ only by case, plural form, or repeated id', async () => {
    mocks.rows = [
      row('1', 'Chicken Thigh', 'proteins'),
      row('2', 'chicken thigh', 'proteins'),
      row('3', 'Chicken Thighs', 'proteins'),
      row('1', 'Chicken Thigh', 'proteins'),
      row('5', 'Chicken Wing', 'proteins'),
    ];
    expect(await names('chicken')).toEqual(['Chicken Wing', 'Chicken Thigh']);
  });

  it('applies the limit after dedup, so duplicates do not crowd out results', async () => {
    mocks.rows = [
      row('1', 'Tomato', 'vegetables'),
      row('2', 'Tomatoes', 'vegetables'),
      row('3', 'tomato', 'vegetables'),
      row('4', 'Tomato Paste', 'condiments'),
    ];
    expect(await names('tomato', 2)).toEqual(['Tomato', 'Tomato Paste']);
  });

  it('never categorizes a stock or broth as Dairy', async () => {
    mocks.rows = [
      row('1', 'Beef or Chicken Stock', 'dairy'),
      row('2', 'Chicken Broth', 'proteins'),
    ];
    const result = await getIngredientSuggestions('chicken', { limit: 8 });
    for (const s of result.suggestions) {
      expect(s.category).not.toBe('dairy');
      expect(s.category).toBe('stocks');
    }
  });
});
