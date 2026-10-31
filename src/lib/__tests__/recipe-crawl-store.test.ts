// @vitest-environment node
/**
 * #142: the merged `storeCrawledRecipe` writes each crawl's own provenance,
 * as the two copies it replaced did: the search crawl its `search_query`, the
 * weekly crawl its week and published date. Real `recipes` table (PGlite).
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/ai/embeddings', () => ({
  generateRecipeEmbedding: async () => {
    throw new Error('no embeddings in test');
  },
}));
vi.mock('@/lib/db/embeddings', () => ({ saveRecipeEmbedding: vi.fn() }));
vi.mock('@/lib/ai/recipe-quality-evaluator', () => ({
  evaluateRecipeQuality: async () => ({ rating: 4, reasoning: 'ok' }),
}));
vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => null,
  getSessionUser: async () => null,
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { recipes } from '@/lib/db/schema';
import type { ExtractedRecipe } from '@/lib/recipe-crawl';
import { storeCrawledRecipe, storeRecipe } from '@/lib/recipe-crawl-store';
import type { WeekInfo } from '@/lib/week-utils';

let client: PGlite;
const recipe: ExtractedRecipe = {
  name: 'Beef Stew',
  description: 'A hearty stew',
  ingredients: ['beef', 'carrot', 'onion'],
  instructions: ['Brown', 'Simmer'],
  prepTime: '1 hour',
  confidenceScore: 0.9,
  isValid: true,
};
const stored = async (id: string) =>
  (
    await client.query<Record<string, unknown>>(
      'SELECT search_query, discovery_week, discovery_year, published_date, prep_time, system_rating FROM "recipes" WHERE id = $1',
      [id]
    )
  ).rows[0];

beforeAll(async () => {
  const built = await createVisibilityDb([recipes], { recipes }, { constraints: true });
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "recipes";');
  for (const level of ['log', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation(() => undefined);
  }
});

describe('storeCrawledRecipe provenance (#142)', () => {
  it('search crawl: writes search_query and no week fields', async () => {
    const res = await storeRecipe(recipe, {
      sourceUrl: 'https://a.com/stew',
      searchQuery: 'stew',
    });
    expect(res.success).toBe(true);
    expect(await stored(res.recipeId as string)).toEqual({
      search_query: 'stew',
      discovery_week: null,
      discovery_year: null,
      published_date: null,
      prep_time: 60,
      system_rating: '4.0',
    });
  });

  it('weekly crawl: writes week, year and a valid published date; an invalid one is null', async () => {
    const week: WeekInfo = { week: 12, year: 2026, startDate: '2026-03-16', endDate: '2026-03-22' };
    const ok = await storeCrawledRecipe(recipe, {
      sourceUrl: 'https://a.com/stew',
      week: { info: week, publishedDate: '2026-03-20' },
    });
    expect(await stored(ok.recipeId as string)).toMatchObject({
      search_query: null,
      discovery_week: 12,
      discovery_year: 2026,
      published_date: expect.any(Date), // timestamp without tz: exact value depends on TZ
    });
    const bad = await storeCrawledRecipe(
      { ...recipe, name: 'Other Stew' },
      { sourceUrl: 'https://b.com/stew', week: { info: week, publishedDate: 'approximate' } }
    );
    expect(await stored(bad.recipeId as string)).toMatchObject({ published_date: null });
  });
});
