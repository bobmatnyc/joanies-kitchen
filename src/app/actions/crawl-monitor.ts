'use server';

// #6: crawl-monitor read API (S3).
/**
 * Why: run history, ledger spend and error text are admin-only, and every
 * export of a 'use server' file is callable by any visitor who can load a page
 * importing it.
 * What: thin wrappers over `@/lib/crawl-monitor`. Each awaits `requireAdmin`
 * before any query, so a non-admin gets the same `Admin access required` /
 * `Authentication required` error as the other gated actions. Cron and
 * scripts import `@/lib/crawl-monitor` directly, never these wrappers.
 * Test: `src/app/actions/__tests__/crawl-monitor-auth.test.ts`
 */

import { requireAdmin } from '@/lib/admin';
import * as monitor from '@/lib/crawl-monitor';

export type {
  CostBreakdown,
  CostSummary,
  DiscoveryRunDetail,
  DiscoveryRunSummary,
  Paged,
  PageInput,
  UnifiedRun,
} from '@/lib/crawl-monitor';

/** Admin-only: one page of discovery runs, newest first. */
export async function getCrawlRuns(
  input?: monitor.PageInput
): Promise<monitor.Paged<monitor.DiscoveryRunSummary>> {
  await requireAdmin();
  return monitor.listDiscoveryRuns(input);
}

/** Admin-only: one discovery run with its items and ledger cost; null if unknown. */
export async function getCrawlRunDetail(runId: string): Promise<monitor.DiscoveryRunDetail | null> {
  await requireAdmin();
  return monitor.getDiscoveryRunDetail(runId);
}

/** Admin-only: ledger spend for today, this month (UTC) and all time. */
export async function getCrawlCostSummary(): Promise<monitor.CostSummary> {
  await requireAdmin();
  return monitor.getCostSummary();
}

/** Admin-only: discovery runs and scraping jobs in one list, newest first. */
export async function getUnifiedCrawlRuns(
  input?: monitor.PageInput
): Promise<monitor.Paged<monitor.UnifiedRun>> {
  await requireAdmin();
  return monitor.listUnifiedRuns(input);
}
