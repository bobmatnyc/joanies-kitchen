'use server';

// #6: manual crawl trigger for /admin/crawl-monitor (S4).
/**
 * Why: the monitor's "Run crawl now" button must start a run that the monitor
 * can see. Only `runDailyDiscovery` writes `recipe_discovery_runs` rows; the
 * `@/app/actions/recipe-crawl` actions write none, and the cron POST route
 * needs `CRON_SECRET`, which must never reach the browser.
 * What: `requireAdmin` first (throws `Admin access required` before any query
 * or paid call), reaps stale `running` rows fail-open, refuses while a
 * discovery run is still `running`, then schedules a `manual` run with
 * `after()` and returns at once. The run takes no caller input, so its budget
 * is the S2 default (`CRON_RUN_BUDGET_USD`, else `DEFAULT_RUN_BUDGET_USD`).
 * Returning early matters: Next.js runs a client's server actions one at a
 * time, so an awaited 5-minute run would block the monitor's polling.
 * The running-row check and the run's insert are not atomic; two admins
 * clicking within the same second can still start two runs.
 * Test: `src/app/actions/__tests__/crawl-trigger-auth.test.ts`
 */

import { eq } from 'drizzle-orm';
import { after } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { recipeDiscoveryRuns } from '@/lib/db/autonomous-scraper-schema';
import { getAutonomousRecipeIngestionService } from '@/lib/services/autonomous-recipe-ingestion.service';
import { reapStaleDiscoveryRunsFailOpen } from '@/lib/services/discovery-run-reaper';

export type TriggerCrawlResult = { started: true } | { started: false; reason: string };

/** Admin-only: start one budgeted `manual` discovery run in the background. */
export async function triggerManualCrawl(): Promise<TriggerCrawlResult> {
  await requireAdmin(); // #6: admin before any query or paid work

  await reapStaleDiscoveryRunsFailOpen('[CrawlMonitor]');
  const [active] = await db
    .select({ id: recipeDiscoveryRuns.id })
    .from(recipeDiscoveryRuns)
    .where(eq(recipeDiscoveryRuns.status, 'running'))
    .limit(1);
  if (active) return { started: false, reason: 'A discovery run is already running.' };

  after(async () => {
    try {
      const result = await getAutonomousRecipeIngestionService().runDailyDiscovery({
        runType: 'manual',
      });
      console.log(`[CrawlMonitor] Manual run ${result.runId} finished: ${result.status}`);
    } catch (error) {
      console.error('[CrawlMonitor] Manual run failed:', error);
    }
  });
  return { started: true };
}
