/**
 * runRecordedWeeklyCrawl (#6 S2): the local/pm2 weekly crawl as one recorded
 * discovery run. `crawlWeeklyRecipes` is replaced by a fake that books one
 * cost event per URL and honours `shouldContinue` the way the real loop does
 * (proven separately in recipe-crawl-should-continue.test.ts); `@/lib/db` is an
 * in-memory fake.
 */

import { getTableName, type Table } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  RUN_ID: '22222222-3333-4444-8555-666666666666',
  failRunCreate: false,
  failItems: false,
  inserts: [] as { table: string; values: Record<string, unknown> }[],
  updates: [] as { table: string; values: Record<string, unknown> }[],
  crawled: [] as string[],
  /** Per week: URL -> result status. */
  weeks: {} as Record<number, Record<string, 'stored' | 'rejected' | 'failed'>>,
  usdPerUrl: 0.4,
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: (table: Table) => ({
      values: (values: Record<string, unknown>) => {
        const p = (async () => {
          const name = getTableName(table);
          if (name === 'recipe_discovery_runs' && fake.failRunCreate) throw new Error('db down');
          if (name === 'recipe_discovery_run_items' && fake.failItems) throw new Error('db down');
          if (name === 'crawl_cost_events') return [];
          fake.inserts.push({ table: name, values });
          return [{ id: fake.RUN_ID }];
        })();
        return Object.assign(p, { returning: () => p });
      },
    }),
    update: (table: Table) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          fake.updates.push({ table: getTableName(table), values });
        },
      }),
    }),
  },
}));

vi.mock('@/app/actions/recipe-crawl', async () => {
  const { trackCost } = await import('@/lib/costs');
  return {
    crawlWeeklyRecipes: vi.fn(
      async (weeksAgo: number, options?: { shouldContinue?: () => boolean }) => {
        const plan = fake.weeks[weeksAgo] ?? {};
        const urls = Object.keys(plan);
        const recipes: {
          id?: string;
          name: string;
          url: string;
          status: string;
          reason?: string;
        }[] = [];
        const stats = { searched: urls.length, converted: 0, approved: 0, stored: 0, failed: 0 };
        const stoppedUrls: string[] = [];
        for (const [i, url] of urls.entries()) {
          if (options?.shouldContinue && !options.shouldContinue()) {
            stoppedUrls.push(...urls.slice(i));
            break;
          }
          fake.crawled.push(url);
          await trackCost({
            provider: 'firecrawl',
            operation: 'scrape',
            measuredUsd: fake.usdPerUrl,
          });
          const status = plan[url];
          if (status !== 'failed') stats.converted++;
          if (status === 'stored') stats.stored++;
          if (status === 'failed') stats.failed++;
          recipes.push({
            url,
            name: url,
            status,
            id: status === 'stored' ? `recipe-${i}` : undefined,
            reason: status === 'stored' ? undefined : `${status} reason`,
          });
        }
        return { success: true, weekInfo: {}, stats, recipes, stoppedUrls };
      }
    ),
  };
});

import { runRecordedWeeklyCrawl } from '@/lib/services/recorded-weekly-crawl';

const u = (slug: string) => `https://www.weekly-kitchen.com/r/${slug}`;
const items = () =>
  fake.inserts.filter((i) => i.table === 'recipe_discovery_run_items').map((i) => i.values);
const runUpdate = () => {
  const ups = fake.updates.filter((x) => x.table === 'recipe_discovery_runs');
  expect(ups).toHaveLength(1);
  return ups[0].values;
};

beforeEach(() => {
  Object.assign(fake, {
    failRunCreate: false,
    failItems: false,
    inserts: [],
    updates: [],
    crawled: [],
    weeks: {},
    usdPerUrl: 0.4,
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runRecordedWeeklyCrawl — budget', () => {
  it("stops mid-week once a single week's URLs exceed the budget", async () => {
    fake.weeks[0] = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((s) => [u(s), 'stored']));

    const run = await runRecordedWeeklyCrawl({
      weeks: [0],
      maxResultsPerWeek: 5,
      autoApprove: true,
      budgetUsd: 1,
      delayBetweenWeeksMs: 0,
    });

    // $0.40 x 3 = $1.20 >= $1.00 before the 4th URL: no 4th or 5th paid call.
    expect(fake.crawled).toEqual([u('a'), u('b'), u('c')]);
    expect(run.status).toBe('partial');
    expect(run.errors).toContain('budget exceeded: $1.2000 of $1.00');
    const update = runUpdate();
    expect(update.status).toBe('partial');
    expect(update.cost_usd).toBe('1.200000');
    expect(
      items()
        .filter((r) => r.outcome === 'budget_stopped')
        .map((r) => r.url)
    ).toEqual([u('d'), u('e')]);
  });

  it('skips the remaining weeks once the budget trips', async () => {
    fake.weeks[0] = { [u('a')]: 'stored', [u('b')]: 'stored', [u('c')]: 'stored' };
    fake.weeks[1] = { [u('z')]: 'stored' };

    const run = await runRecordedWeeklyCrawl({
      weeks: [0, 1],
      maxResultsPerWeek: 5,
      autoApprove: true,
      budgetUsd: 1,
      delayBetweenWeeksMs: 0,
    });

    expect(run.weeks).toHaveLength(1);
    expect(fake.crawled).not.toContain(u('z'));
    expect(run.status).toBe('partial');
  });
});

describe('runRecordedWeeklyCrawl — items', () => {
  it('maps crawl results to item outcomes, tiers and recipe ids', async () => {
    fake.usdPerUrl = 0.01;
    fake.weeks[2] = { [u('s')]: 'stored', [u('r')]: 'rejected', [u('f')]: 'failed' };

    const run = await runRecordedWeeklyCrawl({
      weeks: [2],
      maxResultsPerWeek: 5,
      autoApprove: false,
      runType: 'local',
      budgetUsd: 5,
      delayBetweenWeeksMs: 0,
    });

    expect(items().map((r) => [r.url, r.outcome, r.extraction_tier, r.recipe_id, r.error])).toEqual(
      [
        [u('s'), 'stored', 'firecrawl', 'recipe-0', null],
        [u('r'), 'skipped_quality', 'firecrawl', null, 'rejected reason'],
        [u('f'), 'failed', 'unknown', null, 'failed reason'],
      ]
    );
    expect(fake.inserts.find((i) => i.table === 'recipe_discovery_runs')?.values).toMatchObject({
      run_type: 'local',
      budget_usd: '5.000000',
    });
    expect(runUpdate()).toMatchObject({
      status: 'partial',
      urls_discovered: 3,
      recipes_extracted: 2,
      recipes_stored: 1,
      recipes_skipped: 1,
    });
    expect(run.tracked).toBe(true);
  });

  it('adds one "item writes failed: N" error when item writes fail', async () => {
    fake.usdPerUrl = 0.01;
    fake.failItems = true;
    fake.weeks[0] = { [u('a')]: 'stored', [u('b')]: 'stored' };

    const run = await runRecordedWeeklyCrawl({
      weeks: [0],
      maxResultsPerWeek: 5,
      autoApprove: true,
      delayBetweenWeeksMs: 0,
    });

    expect(run.status).toBe('completed');
    expect(runUpdate().errors).toEqual(['item writes failed: 2']);
  });
});

describe('runRecordedWeeklyCrawl — untracked', () => {
  it('runs untracked when the run row cannot be created', async () => {
    fake.usdPerUrl = 0.01;
    fake.failRunCreate = true;
    fake.weeks[0] = { [u('a')]: 'stored' };

    const run = await runRecordedWeeklyCrawl({
      weeks: [0],
      maxResultsPerWeek: 5,
      autoApprove: true,
      delayBetweenWeeksMs: 0,
    });

    expect(run).toMatchObject({ runId: null, tracked: false, status: 'completed' });
    expect(fake.crawled).toEqual([u('a')]);
    expect(items()).toHaveLength(0);
    expect(fake.updates).toHaveLength(0);
  });
});
