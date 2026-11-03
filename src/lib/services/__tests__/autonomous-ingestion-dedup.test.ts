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
  /** Runs inside every duplicate lookup, before it resolves; may throw or be async. */
  duringLookup: undefined as (() => void | Promise<void>) | undefined,
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
      await state.duringLookup?.();
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
import { skipsKnownUrls } from '@/lib/services/known-url-skip';
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
  const held = 'https://c.com/stew?utm_source=x';
  const fresh = 'https://c.com/beef-stew';
  /** Another user's private recipe: the #135 pre-checks cannot see it, so the insert hits the index. */
  const seedHolder = (name: string) =>
    client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source,
        canonical_source_url, is_public)
      VALUES ('held-1', 'other-1', '${name}', '[]', '[]', 'https://c.com/stew', 'https://c.com/stew', false)`);
  /** Every recipe stored under the held URL, keyed or not. */
  const rowsAtHeldUrl = async () =>
    (
      await client.query<{ id: string; name: string; canonical_source_url: string | null }>(
        `SELECT id, name, canonical_source_url FROM "recipes"
          WHERE source IN ('https://c.com/stew', $1) OR canonical_source_url = 'https://c.com/stew'
          ORDER BY id`,
        [held]
      )
    ).rows;

  it('counts a URL a hidden same-name live recipe holds as a skipped duplicate, not a failure, and stores the rest', async () => {
    await seedHolder('LAMB stew');
    const { service } = buildService({ [held]: 'Lamb Stew', [fresh]: 'Beef Stew' });

    // #142 (D7c): a manual run re-fetches, so the URL reaches the insert and the index.
    const result = await service.runDailyDiscovery({
      maxRecipes: 5,
      budgetUsd: 5,
      runType: 'manual',
    });

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

  // #142: a roundup page holds several recipes under one URL; a manual run re-fetches it.
  it('manual run (#142): stores a recipe of another name under a held URL with a NULL key, counted as stored', async () => {
    await seedHolder('Private Stew');
    const { service } = buildService({ [held]: 'Lamb Stew', [fresh]: 'Beef Stew' });

    const result = await service.runDailyDiscovery({
      maxRecipes: 5,
      budgetUsd: 5,
      runType: 'manual',
    });

    expect(result).toMatchObject({
      status: 'completed',
      recipesStored: 2,
      recipesSkipped: 0,
      errors: [],
    });
    const item = await client.query<{ outcome: string; recipe_id: string | null }>(
      'SELECT outcome, recipe_id FROM "recipe_discovery_run_items" WHERE url = $1',
      [held]
    );
    expect(item.rows[0]).toMatchObject({ outcome: 'stored', recipe_id: expect.any(String) });
    const row = await client.query<{ name: string; source: string; canonical_source_url: null }>(
      'SELECT name, source, canonical_source_url FROM "recipes" WHERE id = $1',
      [item.rows[0].recipe_id]
    );
    expect(row.rows).toEqual([{ name: 'Lamb Stew', source: held, canonical_source_url: null }]);
  });

  // #142: the cron crawl skips a stored URL before any fetch, whatever the holder's name.
  it('cron run (#142): skips a URL a recipe of another name holds, and inserts no row for it', async () => {
    await seedHolder('Private Stew');
    const { service, extractRecipe } = buildService({ [held]: 'Lamb Stew', [fresh]: 'Beef Stew' });

    const result = await service.runDailyDiscovery({
      maxRecipes: 5,
      budgetUsd: 5,
      runType: 'daily',
    });

    expect(extractRecipe.mock.calls.map(([u]) => u)).toEqual([fresh]);
    expect(result).toMatchObject({
      status: 'completed',
      recipesStored: 1,
      recipesSkipped: 1,
      errors: [],
    });
    expect(await rowsAtHeldUrl()).toEqual([
      { id: 'held-1', name: 'Private Stew', canonical_source_url: 'https://c.com/stew' },
    ]);
  });
  // #142: a holder that appears after the cron pre-check (here a manual import landing
  // mid-run, invisible to the #135 checks) reaches the insert; the cron run still skips it.
  it('cron run (#142): a URL another-name recipe takes between the pre-check and the insert is skipped, with no NULL-key row', async () => {
    let seeded = false;
    state.duringLookup = async () => {
      if (seeded) return;
      seeded = true;
      await seedHolder('Private Stew');
    };
    const { service, extractRecipe } = buildService({ [held]: 'Lamb Stew' });

    const result = await service.runDailyDiscovery({
      maxRecipes: 5,
      budgetUsd: 5,
      runType: 'daily',
    });

    expect(extractRecipe.mock.calls.map(([u]) => u)).toEqual([held]);
    expect(result).toMatchObject({
      status: 'completed',
      recipesStored: 0,
      recipesSkipped: 1,
      errors: [],
    });
    const item = await client.query<{ outcome: string; recipe_id: string | null }>(
      'SELECT outcome, recipe_id FROM "recipe_discovery_run_items" WHERE url = $1',
      [held]
    );
    expect(item.rows).toEqual([{ outcome: 'skipped_duplicate', recipe_id: 'held-1' }]);
    expect(await rowsAtHeldUrl()).toEqual([
      { id: 'held-1', name: 'Private Stew', canonical_source_url: 'https://c.com/stew' },
    ]);
  });
});

describe('known-URL skip: cron only (#142 D7c)', () => {
  const known = 'https://www.a.com/chicken-soup/';
  const knownVariant = 'https://a.com/chicken-soup?utm_source=newsletter';

  beforeEach(async () => {
    // The key a recipe insert writes (9fc9245); the seed row of beforeEach has none.
    await client.exec(
      `UPDATE "recipes" SET canonical_source_url = 'https://a.com/chicken-soup' WHERE id = 'seed-1'`
    );
  });

  it.each([
    ['daily', true],
    ['manual', false],
    ['local', false],
  ] as const)('skipsKnownUrls(%s) is %s', (runType, expected) => {
    expect(skipsKnownUrls(runType)).toBe(expected);
  });

  it('cron run: a URL a live recipe holds is skipped without a fetch, and the count is logged', async () => {
    const log = vi.spyOn(console, 'log');
    const { service, extractRecipe } = buildService({ [knownVariant]: 'Chicken Soup' });

    const result = await service.runDailyDiscovery({
      maxRecipes: 5,
      budgetUsd: 5,
      runType: 'daily',
    });

    expect(extractRecipe).not.toHaveBeenCalled();
    expect(result).toMatchObject({ recipesStored: 0, recipesSkipped: 1, errors: [] });
    expect(log.mock.calls.flat().join('\n')).toContain('skipped 1 known URL(s) without fetching');
  });

  it('manual run: the same known URL is fetched again, and no duplicate is stored', async () => {
    const { service, extractRecipe } = buildService({ [knownVariant]: 'Chicken Soup' });

    const result = await service.runDailyDiscovery({
      maxRecipes: 5,
      budgetUsd: 5,
      runType: 'manual',
    });

    expect(extractRecipe).toHaveBeenCalledTimes(1);
    expect(extractRecipe).toHaveBeenCalledWith(knownVariant);
    expect(result).toMatchObject({ recipesStored: 0, recipesSkipped: 1, errors: [] });
    const n = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM "recipes"');
    expect(n.rows[0].n).toBe(1);
  });

  it('cron run: an unknown URL is still fetched and stored', async () => {
    const fresh = 'https://a.com/beef-stew';
    const { service, extractRecipe } = buildService({
      [known]: 'Chicken Soup',
      [fresh]: 'Beef Stew',
    });

    const result = await service.runDailyDiscovery({
      maxRecipes: 5,
      budgetUsd: 5,
      runType: 'daily',
    });

    expect(extractRecipe.mock.calls.map(([u]) => u)).toEqual([fresh]);
    expect(result).toMatchObject({ recipesStored: 1, recipesSkipped: 1 });
  });
});
