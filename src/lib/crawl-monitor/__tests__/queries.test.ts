/**
 * #6 S3: crawl-monitor query layer. Drizzle runs on a pg-proxy driver that
 * captures the SQL and parameters, so the tests check that aggregation,
 * ordering and paging happen in Postgres, and feed back positional rows.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Responder = (sql: string, params: unknown[]) => unknown[][];

const captured = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  respond: (() => []) as Responder,
}));

vi.mock('@/lib/db', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  return {
    db: drizzle(async (sql, params) => {
      captured.queries.push({ sql, params });
      return { rows: captured.respond(sql, params) };
    }),
  };
});

import {
  getCostSummary,
  getDiscoveryRunDetail,
  listDiscoveryRuns,
  listUnifiedRuns,
  MAX_PAGE_SIZE,
  MAX_RUN_DETAIL_ITEMS,
  parsePageInput,
} from '@/lib/crawl-monitor';

const RUN_A = '11111111-1111-4111-8111-111111111111';
const RUN_B = '22222222-2222-4222-8222-222222222222';
const JOB_1 = '33333333-3333-4333-8333-333333333333';

/** A `recipe_discovery_runs` row in table column order. */
function runRow(id: string, startedAt: string, costUsd: string | null) {
  return [
    id,
    'daily',
    'completed',
    10,
    4,
    3,
    1,
    0,
    ['boom'],
    false,
    startedAt,
    '2026-10-28 05:04:00',
    240000,
    costUsd,
    '5.000000',
    0,
  ];
}

const isCountsQuery = (sql: string) =>
  sql.includes('from "recipe_discovery_run_items"') && sql.includes('group by');

beforeEach(() => {
  captured.queries = [];
  captured.respond = () => [];
});

describe('parsePageInput', () => {
  it('parsePageInput clamps pageSize and rejects invalid input', () => {
    expect(parsePageInput(undefined)).toEqual({ page: 1, pageSize: 25, offset: 0 });
    expect(parsePageInput({ page: 3, pageSize: 10 })).toEqual({
      page: 3,
      pageSize: 10,
      offset: 20,
    });
    expect(parsePageInput({ pageSize: 5000 }).pageSize).toBe(MAX_PAGE_SIZE);
    for (const bad of [
      { page: 0 },
      { pageSize: 0 },
      { page: 1.5 },
      { pageSize: -1 },
      { page: '2' },
      { extra: 1 },
      'x',
    ]) {
      expect(() => parsePageInput(bad)).toThrow(RangeError);
    }
  });
});

describe('listDiscoveryRuns', () => {
  it('listDiscoveryRuns pages newest first and counts items in SQL', async () => {
    captured.respond = (sql) =>
      isCountsQuery(sql)
        ? [
            [RUN_A, 'stored', 3],
            [RUN_A, 'failed', 2],
            [RUN_B, 'skipped_duplicate', 1],
          ]
        : [
            runRow(RUN_A, '2026-10-28 05:00:00', '0.420000'),
            runRow(RUN_B, '2026-10-27 05:00:00', null),
            runRow('extra', '2026-10-26 05:00:00', null),
          ];

    const result = await listDiscoveryRuns({ page: 2, pageSize: 2 });

    expect(captured.queries).toHaveLength(2);
    const [list, counts] = captured.queries;
    expect(list.sql).toContain('from "recipe_discovery_runs"');
    expect(list.sql).toMatch(/order by "recipe_discovery_runs"\."started_at" desc nulls last/);
    expect(list.params).toEqual([3, 2]); // limit pageSize + 1, offset (page - 1) * pageSize
    expect(counts.sql).toMatch(
      /count\(\*\).*group by "recipe_discovery_run_items"\."run_id", "recipe_discovery_run_items"\."outcome"/
    );
    expect(counts.params).toEqual([RUN_A, RUN_B]);

    expect(result.hasMore).toBe(true);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      id: RUN_A,
      status: 'completed',
      cost_usd: 0.42,
      budget_usd: 5,
      error_count: 1,
      item_counts: { stored: 3, failed: 2 },
      item_total: 5,
    });
    expect(result.rows[0].started_at).toEqual(new Date('2026-10-28T05:00:00.000Z'));
    expect(result.rows[1]).toMatchObject({ id: RUN_B, cost_usd: null, item_total: 1 });
  });

  it('listDiscoveryRuns rejects invalid paging before querying', async () => {
    await expect(listDiscoveryRuns({ pageSize: 0 })).rejects.toThrow(RangeError);
    await expect(listUnifiedRuns({ page: -1 })).rejects.toThrow(RangeError);
    expect(captured.queries).toHaveLength(0);
  });
});

describe('getDiscoveryRunDetail', () => {
  it('getDiscoveryRunDetail returns the run, its items and its ledger cost', async () => {
    captured.respond = (sql) => {
      if (sql.includes('from "crawl_cost_events"')) {
        return [
          ['firecrawl', 'scrape', 0.3, 0.3, 3],
          ['openrouter', 'chat', 0.12, 0, 4],
        ];
      }
      if (isCountsQuery(sql)) return [[RUN_A, 'stored', 1]];
      if (sql.includes('from "recipe_discovery_run_items"')) {
        return [
          [
            1,
            RUN_A,
            'https://a.example/r',
            'a.example',
            'firecrawl',
            'stored',
            null,
            'rec-1',
            '2026-10-28 05:01:00',
          ],
        ];
      }
      return [runRow(RUN_A, '2026-10-28 05:00:00', '0.420000')];
    };

    const detail = await getDiscoveryRunDetail(RUN_A);

    expect(captured.queries).toHaveLength(4);
    const cost = captured.queries.find((q) => q.sql.includes('crawl_cost_events'));
    expect(cost?.sql).toMatch(
      /where "crawl_cost_events"\."run_id" = \$2 group by "crawl_cost_events"\."provider", "crawl_cost_events"\."operation"/
    );
    expect(cost?.params).toEqual([true, RUN_A]);
    const items = captured.queries.find((q) => q.sql.includes('"url"'));
    expect(items?.params).toEqual([RUN_A, MAX_RUN_DETAIL_ITEMS + 1]);

    expect(detail?.run).toMatchObject({ id: RUN_A, errors: ['boom'], item_counts: { stored: 1 } });
    expect(detail?.items).toHaveLength(1);
    expect(detail?.items_truncated).toBe(false);
    expect(detail?.cost).toMatchObject({ usd: 0.42, estimatedUsd: 0.3, events: 7 });
    expect(detail?.cost.byProvider.map((p) => p.provider)).toEqual(['firecrawl', 'openrouter']);
    expect(detail?.cost.byOperation).toHaveLength(2);
  });

  it('getDiscoveryRunDetail returns null for an unknown run', async () => {
    expect(await getDiscoveryRunDetail(RUN_B)).toBeNull();
    expect(captured.queries).toHaveLength(1);

    captured.queries = [];
    await expect(getDiscoveryRunDetail("1' or 1=1 --")).rejects.toThrow('Invalid run id');
    expect(captured.queries).toHaveLength(0);
  });
});

describe('getCostSummary', () => {
  it('getCostSummary buckets today, this month and all time in one grouped query', async () => {
    // provider, operation, today usd/est/events, month usd/est/events, all usd/est/events
    captured.respond = () => [
      ['tavily', 'search.basic', 0.016, 0.016, 2, 0.04, 0.04, 5, 1.2, 1.2, 150],
      ['openrouter', 'chat', 0, 0, 0, 0.5, 0, 10, 3, 0, 60],
      ['firecrawl', 'scrape', 0, 0, 0, 0, 0, 0, 0.9, 0.9, 90],
    ];

    const summary = await getCostSummary(new Date('2026-10-28T13:45:00.000Z'));

    expect(captured.queries).toHaveLength(1);
    const { sql, params } = captured.queries[0];
    expect(sql).toMatch(/sum\("usd"\) filter \(where "crawl_cost_events"\."created_at" >= \$1\)/);
    expect(sql).toMatch(
      /group by "crawl_cost_events"\."provider", "crawl_cost_events"\."operation"$/
    );
    expect(params).toContain('2026-10-28T00:00:00.000Z');
    expect(params).toContain('2026-10-01T00:00:00.000Z');

    expect(summary.todayStart.toISOString()).toBe('2026-10-28T00:00:00.000Z');
    expect(summary.today).toMatchObject({ usd: 0.016, events: 2 });
    expect(summary.today.byProvider.map((p) => p.provider)).toEqual(['tavily']);
    expect(summary.month).toMatchObject({ usd: 0.54, estimatedUsd: 0.04, events: 15 });
    expect(summary.month.byProvider.map((p) => p.provider)).toEqual(['openrouter', 'tavily']);
    expect(summary.allTime.usd).toBeCloseTo(5.1);
    expect(summary.allTime.events).toBe(300);
    expect(summary.allTime.byOperation[0]).toMatchObject({
      provider: 'openrouter',
      operation: 'chat',
      usd: 3,
    });
  });
});

describe('listUnifiedRuns', () => {
  it('listUnifiedRuns merges both tables in one ordered UNION ALL', async () => {
    captured.respond = (sql) =>
      isCountsQuery(sql)
        ? [
            [RUN_A, 'stored', 3],
            [RUN_A, 'failed', 2],
          ]
        : [
            [
              'scraping_job',
              JOB_1,
              'running',
              'https://chef.example',
              '2026-10-28 06:00:00',
              null,
              null,
              7,
              1,
              null,
            ],
            [
              'discovery',
              RUN_A,
              'completed',
              'daily',
              '2026-10-28 05:00:00',
              '2026-10-28 05:04:00',
              '0.420000',
              3,
              null,
              1,
            ],
            ['discovery', RUN_B, 'failed', 'manual', '2026-10-27 05:00:00', null, null, 0, null, 0],
          ];

    const result = await listUnifiedRuns({ pageSize: 5 });

    expect(captured.queries).toHaveLength(2);
    const [union, counts] = captured.queries;
    expect(union.sql).toContain('union all');
    expect(union.sql).toContain('from "recipe_discovery_runs"');
    expect(union.sql).toContain('from "scraping_jobs"');
    expect(union.sql).toMatch(/order by "started_at" desc nulls last, "id" desc\s+limit \$\d+$/);
    expect(union.params).toEqual([6]); // pageSize + 1; offset 0 is omitted
    expect(counts.params).toEqual([RUN_A, RUN_B]);

    expect(result.hasMore).toBe(false);
    expect(result.rows.map((r) => r.source)).toEqual(['scraping_job', 'discovery', 'discovery']);
    expect(result.rows[0]).toMatchObject({
      id: JOB_1,
      cost_usd: null,
      items: { succeeded: 7, failed: 1, skipped: null },
    });
    expect(result.rows[0].started_at).toEqual(new Date('2026-10-28T06:00:00.000Z'));
    expect(result.rows[1]).toMatchObject({
      cost_usd: 0.42,
      items: { succeeded: 3, failed: 2, skipped: 1 },
    });
    // A discovery run with no item rows (pre-S2) has an unknown failed count.
    expect(result.rows[2].items).toEqual({ succeeded: 0, failed: null, skipped: 0 });
  });
});
