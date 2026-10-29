// @vitest-environment node
/**
 * #135: the daily autonomous ingestion run skips a duplicate instead of
 * inserting it, against real tables (PGlite). Discovery and extraction are
 * injected stubs. The run's existing exact-URL batch check misses these
 * variants; the per-URL `findDuplicateRecipe` check catches them.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/services/recipe-discovery.service', () => ({ getRecipeDiscoveryService: vi.fn() }));
vi.mock('@/lib/services/recipe-extraction.service', () => ({
  getRecipeExtractionService: vi.fn(),
}));
vi.mock('@/lib/services/chef-discovery.service', () => ({ getChefDiscoveryService: vi.fn() }));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import {
  crawlCostEvents,
  recipeDiscoveryRunItems,
  recipeDiscoveryRuns,
  recipeOfTheDay,
} from '@/lib/db/autonomous-scraper-schema';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { AutonomousRecipeIngestionService } from '@/lib/services/autonomous-recipe-ingestion.service';
import type { ScrapedRecipe } from '@/lib/services/recipe-extraction.service';

let client: PGlite;

beforeAll(async () => {
  const tables = {
    recipes,
    recipeDiscoveryRuns,
    recipeDiscoveryRunItems,
    crawlCostEvents,
    recipeOfTheDay,
    chefs,
    chefRecipes,
  };
  const built = await createVisibilityDb(Object.values(tables), tables, { constraints: true });
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec(
    'DELETE FROM "recipes"; DELETE FROM "recipe_discovery_run_items"; DELETE FROM "recipe_discovery_runs";'
  );
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, is_public)
    VALUES ('seed-1', 'system', 'Chicken Soup', '[]', '[]', 'https://www.a.com/chicken-soup/', true)`);
  for (const level of ['log', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation(() => undefined);
  }
});

/** A service whose discovery returns `titles`' URLs and whose extraction returns those titles. */
function buildService(titles: Record<string, string>) {
  const service = new AutonomousRecipeIngestionService();
  const extractRecipe = vi.fn(
    async (url: string): Promise<ScrapedRecipe> => ({
      url,
      title: titles[url],
      ingredients: ['1 carrot', '2 onions'],
      instructions: ['Chop', 'Cook'],
      tags: [],
      extraction_method: 'firecrawl',
    })
  );
  const internals = service as unknown as Record<string, unknown>;
  internals._discoveryService = {
    isConfigured: () => true,
    discoverRecipeUrls: async () =>
      Object.keys(titles).map((url) => ({ url, title: url, searchQuery: 'q', score: 1 })),
  };
  internals._extractionService = { extractRecipe, isViableRecipe: () => true };
  internals._chefDiscoveryService = { findOrCreateChef: vi.fn() };
  internals.sleep = async () => undefined;
  return { service, extractRecipe };
}

describe('AutonomousRecipeIngestionService duplicate guard (#135)', () => {
  it('skips a URL variant and a same-host title, and stores a new recipe', async () => {
    const variant = 'https://a.com/chicken-soup?utm_source=newsletter';
    const sameHost = 'https://a.com/soup-again';
    const fresh = 'https://a.com/beef-stew';
    const otherHost = 'https://b.com/chicken-soup';
    const { service, extractRecipe } = buildService({
      [variant]: 'Whatever',
      [sameHost]: 'Chicken soup',
      [fresh]: 'Beef Stew',
      [otherHost]: 'Chicken Soup',
    });

    const result = await service.runDailyDiscovery({ maxRecipes: 5, budgetUsd: 5 });

    expect(extractRecipe.mock.calls.map(([u]) => u)).not.toContain(variant);
    expect(result).toMatchObject({ recipesStored: 2, recipesSkipped: 2, errors: [] });
    const items = await client.query<{ url: string; outcome: string; recipe_id: string | null }>(
      'SELECT url, outcome, recipe_id FROM "recipe_discovery_run_items" ORDER BY url'
    );
    const skipped = items.rows.filter((r) => r.outcome === 'skipped_duplicate');
    expect(skipped.map((r) => [r.url, r.recipe_id]).sort()).toEqual(
      [
        [sameHost, 'seed-1'],
        [variant, 'seed-1'],
      ].sort()
    );
    const sources = await client.query<{ source: string }>(
      'SELECT source FROM "recipes" ORDER BY source'
    );
    expect(sources.rows.map((r) => r.source)).toEqual([
      fresh,
      otherHost,
      'https://www.a.com/chicken-soup/',
    ]);
  });
});
