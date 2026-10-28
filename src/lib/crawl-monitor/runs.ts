// #6: crawl run reads for the crawl-monitor read API (S3). Plain functions
// with no auth: admin UI reaches them through `@/app/actions/crawl-monitor`,
// server code (cron, scripts) may import them directly. Read-only.

import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  type RecipeDiscoveryRun,
  type RecipeDiscoveryRunItem,
  recipeDiscoveryRunItems,
  recipeDiscoveryRuns,
} from '@/lib/db/autonomous-scraper-schema';
import { scrapingJobs } from '@/lib/db/chef-schema';
import { type CostBreakdown, getRunCostBreakdown } from './costs';
import { MAX_RUN_DETAIL_ITEMS, type PageInput, parsePageInput, parseRunId } from './inputs';

/** Item count per `recipe_discovery_run_items.outcome` value. */
export type OutcomeCounts = Record<string, number>;

export interface DiscoveryRunSummary {
  id: string;
  run_type: string;
  status: string;
  dry_run: boolean;
  started_at: Date | null;
  finished_at: Date | null;
  duration_ms: number | null;
  /** Null on runs written before #6 S2. */
  cost_usd: number | null;
  budget_usd: number | null;
  cost_write_failures: number;
  urls_discovered: number;
  recipes_extracted: number;
  recipes_stored: number;
  recipes_skipped: number;
  error_count: number;
  /** From `recipe_discovery_run_items`; empty for runs written before #6 S2. */
  item_counts: OutcomeCounts;
  item_total: number;
}

export interface Paged<T> {
  rows: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface DiscoveryRunDetail {
  run: DiscoveryRunSummary & { errors: string[] };
  /** Oldest first, at most `MAX_RUN_DETAIL_ITEMS`. */
  items: RecipeDiscoveryRunItem[];
  /** True when the run has more items than `items` holds; `item_counts` covers all. */
  items_truncated: boolean;
  /** From the `crawl_cost_events` ledger; may trail `run.cost_usd` when ledger writes failed. */
  cost: CostBreakdown;
}

export type UnifiedRunSource = 'discovery' | 'scraping_job';

export interface UnifiedRun {
  source: UnifiedRunSource;
  id: string;
  status: string;
  /** Discovery: `run_type`. Scraping job: `source_url`. */
  label: string;
  /** Scraping jobs that never started fall back to `created_at`. */
  started_at: Date | null;
  finished_at: Date | null;
  /** Discovery runs only (null before #6 S2); scraping jobs record no cost. */
  cost_usd: number | null;
  /** Null where the source does not record the count. */
  items: { succeeded: number | null; failed: number | null; skipped: number | null };
}

const toNumber = (v: string | number | null): number | null => (v == null ? null : Number(v));

async function itemCountsByRun(runIds: string[]): Promise<Map<string, OutcomeCounts>> {
  const counts = new Map<string, OutcomeCounts>();
  if (runIds.length === 0) return counts;
  const rows = await db
    .select({
      run_id: recipeDiscoveryRunItems.run_id,
      outcome: recipeDiscoveryRunItems.outcome,
      n: sql<number>`count(*)`.mapWith(Number),
    })
    .from(recipeDiscoveryRunItems)
    .where(inArray(recipeDiscoveryRunItems.run_id, runIds))
    .groupBy(recipeDiscoveryRunItems.run_id, recipeDiscoveryRunItems.outcome);
  for (const r of rows) {
    const c = counts.get(r.run_id) ?? {};
    c[r.outcome] = r.n;
    counts.set(r.run_id, c);
  }
  return counts;
}

function toSummary(run: RecipeDiscoveryRun, counts: OutcomeCounts = {}): DiscoveryRunSummary {
  return {
    id: run.id,
    run_type: run.run_type,
    status: run.status,
    dry_run: run.dry_run ?? false,
    started_at: run.started_at,
    finished_at: run.completed_at,
    duration_ms: run.duration_ms,
    cost_usd: toNumber(run.cost_usd),
    budget_usd: toNumber(run.budget_usd),
    cost_write_failures: run.cost_write_failures ?? 0,
    urls_discovered: run.urls_discovered ?? 0,
    recipes_extracted: run.recipes_extracted ?? 0,
    recipes_stored: run.recipes_stored ?? 0,
    recipes_skipped: run.recipes_skipped ?? 0,
    error_count: run.errors?.length ?? 0,
    item_counts: counts,
    item_total: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}

/**
 * Why: S4's run history table lists discovery runs with their spend.
 * What: validates paging (throws `RangeError` before any query), selects one
 * page of `recipe_discovery_runs` newest `started_at` first, then counts that
 * page's items per outcome in one grouped query. `hasMore` comes from
 * fetching one extra row, so no `count(*)` over the table runs.
 * Test: `listDiscoveryRuns pages newest first and counts items in SQL`,
 * `listDiscoveryRuns rejects invalid paging before querying`
 */
export async function listDiscoveryRuns(input?: PageInput): Promise<Paged<DiscoveryRunSummary>> {
  const { page, pageSize, offset } = parsePageInput(input);
  const rows = await db
    .select()
    .from(recipeDiscoveryRuns)
    .orderBy(sql`${recipeDiscoveryRuns.started_at} desc nulls last`, desc(recipeDiscoveryRuns.id))
    .limit(pageSize + 1)
    .offset(offset);
  const pageRows = rows.slice(0, pageSize);
  const counts = await itemCountsByRun(pageRows.map((r) => r.id));
  return {
    rows: pageRows.map((r) => toSummary(r, counts.get(r.id))),
    page,
    pageSize,
    hasMore: rows.length > pageSize,
  };
}

/**
 * Why: S4's run detail drawer shows one run, what it attempted and what it spent.
 * What: validates `runId` as a UUID (throws `RangeError` before any query).
 * Returns null when no run has that id; otherwise the run with its errors,
 * up to `MAX_RUN_DETAIL_ITEMS` items oldest first, per-outcome counts over
 * all items, and the run's ledger cost by provider and (provider, operation).
 * Test: `getDiscoveryRunDetail returns the run, its items and its ledger cost`,
 * `getDiscoveryRunDetail returns null for an unknown run`
 */
export async function getDiscoveryRunDetail(runId: string): Promise<DiscoveryRunDetail | null> {
  const id = parseRunId(runId);
  const [run] = await db
    .select()
    .from(recipeDiscoveryRuns)
    .where(eq(recipeDiscoveryRuns.id, id))
    .limit(1);
  if (!run) return null;

  const [items, counts, cost] = await Promise.all([
    db
      .select()
      .from(recipeDiscoveryRunItems)
      .where(eq(recipeDiscoveryRunItems.run_id, id))
      .orderBy(asc(recipeDiscoveryRunItems.created_at), asc(recipeDiscoveryRunItems.id))
      .limit(MAX_RUN_DETAIL_ITEMS + 1),
    itemCountsByRun([id]),
    getRunCostBreakdown(id),
  ]);
  return {
    run: { ...toSummary(run, counts.get(id)), errors: run.errors ?? [] },
    items: items.slice(0, MAX_RUN_DETAIL_ITEMS),
    items_truncated: items.length > MAX_RUN_DETAIL_ITEMS,
    cost,
  };
}

/**
 * Why: chef scraping writes `scraping_jobs` and the cron writes
 * `recipe_discovery_runs`; the admin view shows both in one list.
 * What: validates paging, then one `UNION ALL` over both tables in a shared
 * shape, ordered by start time newest first (nulls last) with LIMIT/OFFSET in
 * SQL. A second grouped query fills `items.failed` for the page's discovery
 * runs (null when a run has no item rows). Discovery `succeeded`/`skipped`
 * are `recipes_stored`/`recipes_skipped`; scraping jobs map
 * `recipes_scraped`/`recipes_failed` and report no skipped count or cost.
 * Test: `listUnifiedRuns merges both tables in one ordered UNION ALL`
 */
export async function listUnifiedRuns(input?: PageInput): Promise<Paged<UnifiedRun>> {
  const { page, pageSize, offset } = parsePageInput(input);
  const r = recipeDiscoveryRuns;
  const j = scrapingJobs;

  const discovery = db
    .select({
      source: sql<UnifiedRunSource>`'discovery'`.as('source'),
      id: sql<string>`${r.id}::text`.as('id'),
      status: sql<string>`${r.status}`.as('status'),
      label: sql<string>`${r.run_type}`.as('label'),
      started_at: sql<Date | null>`${r.started_at}`.mapWith(r.started_at).as('started_at'),
      finished_at: sql<Date | null>`${r.completed_at}`.mapWith(r.completed_at).as('finished_at'),
      cost_usd: sql<string | null>`${r.cost_usd}`.as('cost_usd'),
      succeeded: sql<number | null>`${r.recipes_stored}`.as('succeeded'),
      failed: sql<number | null>`null::integer`.as('failed'),
      skipped: sql<number | null>`${r.recipes_skipped}`.as('skipped'),
    })
    .from(r);

  const jobs = db
    .select({
      source: sql<UnifiedRunSource>`'scraping_job'`.as('source'),
      id: sql<string>`${j.id}::text`.as('id'),
      status: sql<string>`${j.status}`.as('status'),
      label: sql<string>`${j.source_url}`.as('label'),
      started_at: sql<Date | null>`coalesce(${j.started_at}, ${j.created_at})`
        .mapWith(j.started_at)
        .as('started_at'),
      finished_at: sql<Date | null>`${j.completed_at}`.mapWith(j.completed_at).as('finished_at'),
      cost_usd: sql<string | null>`null::numeric`.as('cost_usd'),
      succeeded: sql<number | null>`${j.recipes_scraped}`.as('succeeded'),
      failed: sql<number | null>`${j.recipes_failed}`.as('failed'),
      skipped: sql<number | null>`null::integer`.as('skipped'),
    })
    .from(j);

  const rows = await discovery
    .unionAll(jobs)
    .orderBy(sql`"started_at" desc nulls last`, sql`"id" desc`)
    .limit(pageSize + 1)
    .offset(offset);

  const pageRows = rows.slice(0, pageSize);
  const counts = await itemCountsByRun(
    pageRows.filter((x) => x.source === 'discovery').map((x) => x.id)
  );
  return {
    rows: pageRows.map((x) => {
      const failed =
        x.source === 'discovery'
          ? (counts.get(x.id)?.failed ?? (counts.has(x.id) ? 0 : null))
          : x.failed;
      return {
        source: x.source,
        id: x.id,
        status: x.status,
        label: x.label,
        started_at: x.started_at,
        finished_at: x.finished_at,
        cost_usd: toNumber(x.cost_usd),
        items: {
          succeeded: toNumber(x.succeeded),
          failed: toNumber(failed),
          skipped: toNumber(x.skipped),
        },
      };
    }),
    page,
    pageSize,
    hasMore: rows.length > pageSize,
  };
}
