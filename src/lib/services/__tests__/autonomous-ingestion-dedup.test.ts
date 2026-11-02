// @vitest-environment node
/**
 * #135: the daily autonomous ingestion run skips a duplicate instead of
 * inserting it, against real tables (PGlite). Discovery and extraction are
 * injected stubs. The run's existing exact-URL batch check misses these
 * variants; the per-URL `findDuplicateRecipe` check catches them.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  /** Runs inside every duplicate lookup, before it resolves; may throw. */
  duringLookup: undefined as (() => void) | undefined,
}));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/recipes/dedup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/recipes/dedup')>();
  return {
    ...actual,
    findDuplicateRecipe: async (...args: Parameters<typeof actual.findDuplicateRecipe>) => {
      const match = await actual.findDuplicateRecipe(...args);
      state.duringLookup?.();
      return match;
    },
  };
});
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
import { applyMigration0008 } from '@/lib/recipes/__tests__/migration-0008';
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
  await applyMigration0008(client); // #142: the D09 unique index, as on production
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
  state.duringLookup = undefined;
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

  it('fails closed when the duplicate lookup rejects: nothing extracted or inserted', async () => {
    state.duringLookup = () => {
      throw new Error('db down');
    };
    const url = 'https://a.com/beef-stew';
    const { service, extractRecipe } = buildService({ [url]: 'Beef Stew' });

    const result = await service.runDailyDiscovery({ maxRecipes: 5, budgetUsd: 5 });

    expect(extractRecipe).not.toHaveBeenCalled();
    expect(result).toMatchObject({ recipesStored: 0, recipesSkipped: 0 });
    expect(result.errors).toEqual([`${url}: db down`]);
    const n = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM "recipes"');
    expect(n.rows[0].n).toBe(1);
  });

  it('moves no counter when the run is released during the lookup', async () => {
    const url = 'https://a.com/chicken-soup?utm_source=x';
    const { service } = buildService({ [url]: 'Whatever' });
    const m = {
      urlsDiscovered: 1,
      recipesExtracted: 0,
      recipesStored: 0,
      recipesSkipped: 0,
      chefsCreated: 0,
      errors: [] as string[],
      itemWriteFailures: 0,
      tracked: false,
      closed: false,
      itemUrls: new Set<string>(),
    };
    state.duringLookup = () => {
      m.closed = true; // the deadline fires while the lookup is in flight
    };
    const { processUrl } = service as unknown as {
      processUrl: (d: unknown, runId: string, dryRun: boolean, metrics: typeof m) => Promise<void>;
    };

    await processUrl.call(
      service,
      { url, title: url, searchQuery: 'q', score: 1 },
      'run-x',
      false,
      m
    );

    expect(m.recipesSkipped).toBe(0);
    expect(m.itemUrls.size).toBe(0);
  });
});

describe('AutonomousRecipeIngestionService canonical URL conflict (#142 D09)', () => {
  it('counts a URL a hidden live recipe holds as a skipped duplicate, not a failure, and stores the rest', async () => {
    // Another user's private recipe: the #135 pre-checks cannot see it, so the insert hits the index.
    await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source,
        canonical_source_url, is_public)
      VALUES ('held-1', 'other-1', 'Private Stew', '[]', '[]', 'https://c.com/stew', 'https://c.com/stew', false)`);
    const held = 'https://c.com/stew?utm_source=x';
    const fresh = 'https://c.com/beef-stew';
    const { service } = buildService({ [held]: 'Lamb Stew', [fresh]: 'Beef Stew' });

    const result = await service.runDailyDiscovery({ maxRecipes: 5, budgetUsd: 5 });

    expect(result).toMatchObject({
      status: 'completed',
      recipesStored: 1,
      recipesSkipped: 1,
      errors: [],
    });
    const items = await client.query<{ url: string; outcome: string; recipe_id: string | null }>(
      'SELECT url, outcome, recipe_id FROM "recipe_discovery_run_items" ORDER BY url'
    );
    expect(items.rows.find((r) => r.url === held)).toMatchObject({
      outcome: 'skipped_duplicate',
      recipe_id: 'held-1',
    });
    expect(items.rows.find((r) => r.url === fresh)).toMatchObject({ outcome: 'stored' });
    const n = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "recipes" WHERE canonical_source_url = 'https://c.com/stew'`
    );
    expect(n.rows[0].n).toBe(1);
  });
});
