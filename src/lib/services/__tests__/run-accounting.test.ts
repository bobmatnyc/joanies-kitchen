/**
 * Run accounting (#6 S2) for AutonomousRecipeIngestionService, against an
 * in-memory fake of `@/lib/db`:
 * - run-row counters equal the matching per-URL item counts;
 * - Fail-Open (a): with every ledger insert throwing, the in-memory spend still
 *   trips the budget, the run ends `partial`, and write failures are counted;
 * - Fail-Open (b): with every item insert throwing, the run still completes
 *   with correct counters.
 */

import { getTableName, type Table } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const RUN_ID = '11111111-2222-4333-8444-555555555555';
  const state = {
    failLedger: false,
    failItems: false,
    failRunCreate: false,
    failRunUpdate: false,
    slowItemUrl: '',
    dupUrls: [] as string[],
    storeFailUrls: [] as string[],
    inserts: [] as { table: string; values: Record<string, unknown> }[],
    insertAttempts: {} as Record<string, number>,
    updates: [] as { table: string; values: Record<string, unknown> }[],
  };
  let nextId = 0;
  return { RUN_ID, state, nextIdValue: () => `recipe-${++nextId}` };
});

vi.mock('@/lib/db', () => {
  const thenable = <T>(run: () => Promise<T>) => {
    const p = run();
    return Object.assign(p, { returning: () => p, onConflictDoNothing: () => p });
  };
  return {
    db: {
      insert: (table: Table) => ({
        values: (values: Record<string, unknown>) =>
          thenable(async () => {
            const name = getTableName(table);
            fake.state.insertAttempts[name] = (fake.state.insertAttempts[name] ?? 0) + 1;
            if (name === 'crawl_cost_events' && fake.state.failLedger) {
              throw new Error('ledger insert failed: connection refused');
            }
            if (name === 'recipe_discovery_runs' && fake.state.failRunCreate) {
              throw new Error('run insert failed: connection refused');
            }
            if (name === 'recipe_discovery_run_items' && values.url === fake.state.slowItemUrl) {
              await new Promise((r) => setTimeout(r, 150));
            }
            if (name === 'recipe_discovery_run_items' && fake.state.failItems) {
              throw new Error('item insert failed: connection refused');
            }
            if (name === 'recipes' && fake.state.storeFailUrls.includes(values.source as string)) {
              throw new Error('duplicate key value violates unique constraint');
            }
            fake.state.inserts.push({ table: name, values });
            if (name === 'recipe_discovery_runs') return [{ id: fake.RUN_ID }];
            return [{ id: fake.nextIdValue() }];
          }),
      }),
      update: (table: Table) => ({
        set: (values: Record<string, unknown>) => ({
          where: () =>
            thenable(async () => {
              if (getTableName(table) === 'recipe_discovery_runs' && fake.state.failRunUpdate) {
                throw new Error('run update failed: connection terminated');
              }
              fake.state.updates.push({ table: getTableName(table), values });
              return [];
            }),
        }),
      }),
      select: () => ({
        from: (table: Table) => ({
          where: async () => {
            const name = getTableName(table);
            if (name === 'crawl_cost_events') {
              const total = fake.state.inserts
                .filter((i) => i.table === name && i.values.run_id === fake.RUN_ID)
                .reduce((sum, i) => sum + Number(i.values.usd), 0);
              return [{ total: total.toFixed(6) }];
            }
            return name === 'recipes' ? fake.state.dupUrls.map((source) => ({ source })) : [];
          },
        }),
      }),
    },
  };
});

// The pipeline's collaborators are injected per test; stub their modules so
// their import graphs (server-only, API clients) never load.
vi.mock('@/lib/services/recipe-discovery.service', () => ({ getRecipeDiscoveryService: vi.fn() }));
vi.mock('@/lib/services/recipe-extraction.service', () => ({
  getRecipeExtractionService: vi.fn(),
}));
vi.mock('@/lib/services/chef-discovery.service', () => ({ getChefDiscoveryService: vi.fn() }));

import { trackCost } from '@/lib/costs';
import { AutonomousRecipeIngestionService } from '@/lib/services/autonomous-recipe-ingestion.service';
import type { ScrapedRecipe } from '@/lib/services/recipe-extraction.service';

type Plan = 'stored' | 'no-recipe' | 'low-quality' | 'store-fails' | 'hang' | 'late';

const url = (slug: string) => `https://www.example-kitchen.com/recipes/${slug}`;

function recipeFor(u: string, plan: Plan): ScrapedRecipe {
  return {
    url: u,
    title: plan === 'low-quality' ? 'LOW QUALITY' : `Recipe ${u.split('/').pop()}`,
    ingredients: ['1 carrot', '2 onions', 'salt'],
    instructions: ['Chop', 'Cook', 'Serve'],
    tags: [],
    extraction_method: 'firecrawl',
  };
}

/**
 * Builds a service whose discovery returns `urls` (costing `searchUsd`) and
 * whose extraction follows `plans` (each URL costing `extractUsd`).
 */
function buildService(opts: {
  urls: string[];
  plans: Record<string, Plan>;
  searchUsd?: number;
  extractUsd?: number;
  lateMs?: number;
}) {
  const service = new AutonomousRecipeIngestionService();
  const extractRecipe = vi.fn(async (u: string) => {
    await trackCost({
      provider: 'firecrawl',
      operation: 'scrape',
      measuredUsd: opts.extractUsd ?? 0.01,
    });
    const plan = opts.plans[u] ?? 'stored';
    // An extraction that outlives the function limit (the 2026-10-29 run).
    if (plan === 'hang') return new Promise<never>(() => undefined);
    // Resolves after the deadline with a storable recipe.
    if (plan === 'late') {
      await new Promise((r) => setTimeout(r, opts.lateMs ?? 0));
      return recipeFor(u, 'stored');
    }
    return plan === 'no-recipe' ? null : recipeFor(u, plan);
  });
  const internals = service as unknown as Record<string, unknown>;
  internals._discoveryService = {
    isConfigured: () => true,
    discoverRecipeUrls: async () => {
      await trackCost({
        provider: 'tavily',
        operation: 'search.basic',
        measuredUsd: opts.searchUsd ?? 0.01,
      });
      return opts.urls.map((u) => ({ url: u, title: u, searchQuery: 'q', score: 1 }));
    },
  };
  internals._extractionService = {
    extractRecipe,
    isViableRecipe: (r: ScrapedRecipe) => r.title !== 'LOW QUALITY',
  };
  internals._chefDiscoveryService = { findOrCreateChef: vi.fn() };
  internals.sleep = async () => undefined;
  return { service, extractRecipe };
}

function runUpdate() {
  const updates = fake.state.updates.filter((u) => u.table === 'recipe_discovery_runs');
  expect(updates).toHaveLength(1);
  return updates[0].values;
}

function items() {
  return fake.state.inserts
    .filter((i) => i.table === 'recipe_discovery_run_items')
    .map((i) => i.values);
}

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  Object.assign(fake.state, {
    failLedger: false,
    failItems: false,
    failRunCreate: false,
    failRunUpdate: false,
    slowItemUrl: '',
    dupUrls: [],
    storeFailUrls: [],
    inserts: [],
    insertAttempts: {},
    updates: [],
  });
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('run accounting — counters match items', () => {
  it('run-row counters equal the matching item counts for a mixed run', async () => {
    const urls = ['dup', 'none', 'low', 'ok-1', 'store-fail', 'ok-2'].map(url);
    fake.state.dupUrls = [url('dup')];
    fake.state.storeFailUrls = [url('store-fail')];
    const { service } = buildService({
      urls,
      plans: { [url('none')]: 'no-recipe', [url('low')]: 'low-quality' },
    });

    const result = await service.runDailyDiscovery({ maxRecipes: 5, budgetUsd: 100 });

    const run = runUpdate();
    const rows = items();
    const count = (pred: (r: Record<string, unknown>) => boolean) => rows.filter(pred).length;

    // One item per URL attempted. Here every discovered URL is attempted, so
    // urls_discovered also equals the item count (see the maxRecipes test below).
    expect(rows).toHaveLength(urls.length);
    expect(run.urls_discovered).toBe(rows.length);
    expect(run.recipes_stored).toBe(count((r) => r.outcome === 'stored'));
    expect(run.recipes_skipped).toBe(
      count((r) => r.outcome === 'skipped_duplicate' || r.outcome === 'skipped_quality')
    );
    expect(run.recipes_extracted).toBe(count((r) => r.extraction_tier !== 'none'));
    // Guard against a counter that always reads 0.
    expect([run.recipes_stored, run.recipes_skipped, run.recipes_extracted]).toEqual([2, 2, 4]);
    expect(count((r) => r.outcome === 'failed')).toBe(2);
    expect(rows.find((r) => r.outcome === 'stored')?.recipe_id).toMatch(/^recipe-/);
    expect(rows.every((r) => r.source_domain === 'example-kitchen.com')).toBe(true);
    expect(result.recipesStored).toBe(2);
    // 6 cost events of $0.01: 1 search + 5 extractions (the duplicate is never extracted).
    expect(run.cost_usd).toBe('0.060000');
    expect(run.cost_write_failures).toBe(0);
    expect(result.tracked).toBe(true);
  });

  it('urls_discovered exceeds the item count when the maxRecipes stop leaves URLs unattempted', async () => {
    const urls = ['a', 'b', 'c', 'd'].map(url);
    const { service } = buildService({ urls, plans: {} });

    await service.runDailyDiscovery({ maxRecipes: 1, budgetUsd: 100 });

    const run = runUpdate();
    const rows = items();
    // 1 stored, then the loop stops: b, c, d get no item (no not_attempted rows).
    expect(rows.map((r) => r.outcome)).toEqual(['stored']);
    expect(run.urls_discovered).toBe(4);
    expect(run.recipes_stored).toBe(rows.filter((r) => r.outcome === 'stored').length);
  });
});

describe('untracked run', () => {
  it('reports tracked=false and still crawls when the run row cannot be created', async () => {
    fake.state.failRunCreate = true;
    const { service, extractRecipe } = buildService({ urls: [url('a')], plans: {} });

    const result = await service.runDailyDiscovery({ maxRecipes: 5, budgetUsd: 100 });

    expect(result.tracked).toBe(false);
    expect(result.runId).toMatch(/^untracked-/);
    expect(extractRecipe).toHaveBeenCalledTimes(1);
    expect(result.recipesStored).toBe(1);
    expect(fake.state.insertAttempts.recipe_discovery_run_items).toBeUndefined();
    expect(fake.state.updates).toHaveLength(0);
  });
});

describe('Fail-Open (a): budget with a failing ledger', () => {
  it('stops a run over budget, ends partial, and counts write failures when every ledger insert throws', async () => {
    fake.state.failLedger = true;
    const urls = ['a', 'b', 'c', 'd', 'e', 'f'].map(url);
    const { service, extractRecipe } = buildService({
      urls,
      plans: {},
      searchUsd: 0.1,
      extractUsd: 0.4,
    });

    const result = await service.runDailyDiscovery({ maxRecipes: 5, budgetUsd: 1 });

    // $0.10 + 3 x $0.40 = $1.30 >= $1.00 before the 4th URL: no more paid calls.
    expect(extractRecipe).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('partial');
    const run = runUpdate();
    expect(run.status).toBe('partial');
    expect(run.errors).toContain('budget exceeded: $1.3000 of $1.00');
    expect(run.cost_usd).toBe('1.300000');
    expect(run.cost_write_failures).toBe(4);
    expect(fake.state.insertAttempts.crawl_cost_events).toBe(4);
    expect(items().filter((r) => r.outcome === 'budget_stopped')).toHaveLength(3);
  });
});

describe('Fail-Open (b): item writes failing', () => {
  it('a run completes with correct counters when every item insert throws', async () => {
    fake.state.failItems = true;
    fake.state.dupUrls = [url('dup')];
    const urls = ['dup', 'ok-1', 'ok-2', 'ok-3'].map(url);
    const { service } = buildService({ urls, plans: {} });

    const result = await service.runDailyDiscovery({ maxRecipes: 5, budgetUsd: 100 });

    // Every URL attempted an item write, and every write failed...
    expect(fake.state.insertAttempts.recipe_discovery_run_items).toBe(4);
    expect(items()).toHaveLength(0);
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('[RunItems] Failed to record'),
      expect.any(Error)
    );
    // ...yet the run completed with the right counters.
    expect(result.status).toBe('completed');
    const run = runUpdate();
    expect(run).toMatchObject({
      status: 'completed',
      urls_discovered: 4,
      recipes_extracted: 3,
      recipes_stored: 3,
      recipes_skipped: 1,
    });
  });

  it('ends with an "item writes failed: N" error when every item write fails', async () => {
    fake.state.failItems = true;
    const { service } = buildService({ urls: ['a', 'b', 'c'].map(url), plans: {} });

    const result = await service.runDailyDiscovery({ maxRecipes: 5, budgetUsd: 100 });

    // The summary is visible on the run row and the result, without changing the status.
    expect(runUpdate().errors).toEqual(['item writes failed: 3']);
    expect(result.errors).toEqual(['item writes failed: 3']);
    expect(result.status).toBe('completed');
  });
});

describe('#6: deadline finalize', () => {
  it('a run that hits the deadline mid-crawl is finalized partial with item counters and ledger cost', async () => {
    const urls = ['a', 'b', 'hang', 'c'].map(url);
    const { service, extractRecipe } = buildService({ urls, plans: { [url('hang')]: 'hang' } });

    const result = await service.runDailyDiscovery({
      maxRecipes: 5,
      budgetUsd: 100,
      deadlineAt: Date.now() + 100,
    });

    // The hung URL was abandoned at the deadline; `c` was never started.
    expect(extractRecipe).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('partial');
    const run = runUpdate();
    const rows = items();
    expect(rows.map((r) => r.outcome)).toEqual(['stored', 'stored', 'failed']);
    expect(rows[2]).toMatchObject({
      url: url('hang'),
      error: 'deadline: abandoned in flight; may have stored late',
    });
    expect(run).toMatchObject({
      status: 'partial',
      urls_discovered: 4,
      recipes_stored: rows.filter((r) => r.outcome === 'stored').length,
      recipes_extracted: 2,
      recipes_skipped: 0,
    });
    expect(run.completed_at).toBeInstanceOf(Date);
    expect(typeof run.duration_ms).toBe('number');
    // Ledger SUM for the run: 1 search + 3 extractions (the hung one was billed).
    expect(run.cost_usd).toBe('0.040000');
    expect(run.errors).toEqual([expect.stringMatching(/^deadline: stopped after \d+s/)]);
  }, 2000);
});

describe('#6: Fail-Open check on finalize', () => {
  it('a failed finalize write rejects the run instead of reporting success', async () => {
    fake.state.failRunUpdate = true;
    const { service } = buildService({ urls: [url('a')], plans: {} });

    await expect(service.runDailyDiscovery({ maxRecipes: 5, budgetUsd: 100 })).rejects.toThrow(
      /failed to finalize run 11111111-2222-4333-8444-555555555555: run update failed/
    );
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL: failed to finalize run'),
      expect.any(Error)
    );
  });
});

describe('#6: work that resolves after the deadline', () => {
  it('an extraction resolving after close writes nothing and moves no counter', async () => {
    const urls = ['a', 'late', 'c'].map(url);
    const { service } = buildService({ urls, plans: { [url('late')]: 'late' }, lateMs: 150 });

    const result = await service.runDailyDiscovery({
      maxRecipes: 5,
      budgetUsd: 100,
      deadlineAt: Date.now() + 50,
    });
    const rowsAtFinalize = items().length;
    await new Promise((r) => setTimeout(r, 250)); // let the late extraction resolve

    const rows = items();
    expect(rows).toHaveLength(rowsAtFinalize);
    expect(rows.filter((r) => r.url === url('late'))).toEqual([
      expect.objectContaining({
        outcome: 'failed',
        error: 'deadline: abandoned in flight; may have stored late',
      }),
    ]);
    // No storeRecipe insert for the late URL, and one finalize only.
    expect(
      fake.state.inserts.filter((i) => i.table === 'recipes' && i.values.source === url('late'))
    ).toHaveLength(0);
    expect(runUpdate()).toMatchObject({ recipes_stored: 1, recipes_extracted: 1 });
    expect(result.recipesStored).toBe(1);
  }, 2000);
});

describe('#6: abandoned-row claim race', () => {
  it('work resolving during the abandoned-row write adds no row and moves no counter', async () => {
    const urls = ['a', 'late', 'c'].map(url);
    // The abandoned row's insert takes 150ms; the extraction resolves inside it.
    fake.state.slowItemUrl = url('late');
    const { service } = buildService({ urls, plans: { [url('late')]: 'late' }, lateMs: 100 });

    const result = await service.runDailyDiscovery({
      maxRecipes: 5,
      budgetUsd: 100,
      deadlineAt: Date.now() + 50,
    });
    await new Promise((r) => setTimeout(r, 100));

    expect(items().filter((r) => r.url === url('late'))).toEqual([
      expect.objectContaining({
        outcome: 'failed',
        error: 'deadline: abandoned in flight; may have stored late',
      }),
    ]);
    expect(
      fake.state.inserts.filter((i) => i.table === 'recipes' && i.values.source === url('late'))
    ).toHaveLength(0);
    expect(runUpdate()).toMatchObject({ recipes_stored: 1, recipes_extracted: 1 });
    expect(result.recipesStored).toBe(1);
  }, 2000);
});
