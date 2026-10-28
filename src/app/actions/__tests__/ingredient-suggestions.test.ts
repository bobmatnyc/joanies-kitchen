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

  // #47: production rows (name differs from display_name), in the order the
  // SQL returned them, hitting the early-return fast path (>= limit rows).
  it.each([
    [
      'chicken',
      [
        ['chicken', 'Frying Chicken', true],
        ['chicken breast', 'Chicken Breast', true],
        ['chicken broth', 'Chicken Broth', true],
        ['chicken stock', 'Chicken Stock', true],
        ['chicken base', 'Chicken Base', false],
        ['chicken bouillon', 'Chicken Bouillon', false],
        ['chicken carcasses', 'Chicken Carcasses', false],
        ['chicken cutlets', 'Chicken Cutlets', false],
        ['chicken drummettes', 'Chicken Drummettes', false],
      ],
      'Frying Chicken',
    ],
    [
      'stock',
      [
        ['stock', 'Vegetable or Chicken Stock', false],
        ['stock cubes', 'Stock Cubes', false],
        ['chicken stock', 'Chicken Stock', true],
        ['beef stock concentrate', 'Beef Stock Concentrate', false],
        ['fish stock', 'Fish Stock', false],
        ['ham stock', 'Ham Stock', false],
        ['lobster stock', 'Lobster Stock', false],
        ['meat stock', 'Meat Stock', false],
        ['turkey stock', 'Turkey Stock', false],
      ],
      'Vegetable or Chicken Stock',
    ],
  ] as const)('ranks prefix before word-prefix on the production path: %s', async (q, data, wordPrefix) => {
    mocks.rows = data.map(([name, displayName, isCommon], i) => ({
      id: String(i),
      name,
      displayName,
      category: null,
      isCommon,
    }));
    const got = await names(q, 9);
    const prefixCount = data.filter(([, d]) => d.toLowerCase().startsWith(q)).length;
    // Every prefix match (up to the limit) precedes every word-prefix match.
    expect(got.slice(0, prefixCount).every((n) => n.toLowerCase().startsWith(q))).toBe(true);
    expect(got).toContain(wordPrefix);
    expect(got.indexOf(wordPrefix)).toBeGreaterThanOrEqual(prefixCount);
  });

  // #47: matchTier falls back to name when display_name is empty.
  it('ranks an exact name match with empty display_name as exact', async () => {
    mocks.rows = [
      { id: 'a', name: 'chicken breast', displayName: 'Chicken Breast', category: null, isCommon: true },
      { id: 'b', name: 'chicken', displayName: '', category: null, isCommon: false },
    ];
    const result = await getIngredientSuggestions('chicken', { limit: 2 });
    expect(result.suggestions[0].id).toBe('b');
  });
});
