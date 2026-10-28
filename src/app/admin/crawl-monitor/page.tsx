// #6: /admin/crawl-monitor — crawl spend, running job, run history, manual trigger (S4).

// Force dynamic rendering for admin pages (requires authentication headers)
export const dynamic = 'force-dynamic';
// #6: the manual trigger's run continues in `after()` within this budget.
export const maxDuration = 300;

import { redirect } from 'next/navigation';
import { getCrawlCostSummary, getUnifiedCrawlRuns } from '@/app/actions/crawl-monitor';
import { CrawlMonitorDashboard } from '@/components/admin/crawl-monitor/CrawlMonitorDashboard';
import { RUNS_PAGE_SIZE } from '@/components/admin/crawl-monitor/format';
import { checkAdminAccess } from '@/lib/admin';

export const metadata = {
  title: 'Crawl Monitor | Admin',
  description: 'Crawl runs and spend',
};

/**
 * Why: run history and spend are admin-only; the admin layout already gates
 * `/admin/*`, and this page checks again so it stays gated if moved.
 * What: redirects a non-admin to `/` (as the layout does) before any query,
 * then loads the cost summary and page 1 of the unified runs.
 * Test: `src/app/admin/crawl-monitor/__tests__/page-auth.test.tsx`
 */
export default async function CrawlMonitorPage() {
  const { isAdmin } = await checkAdminAccess();
  if (!isAdmin) redirect('/');

  const [summary, runs] = await Promise.all([
    getCrawlCostSummary(),
    getUnifiedCrawlRuns({ page: 1, pageSize: RUNS_PAGE_SIZE }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Crawl Monitor</h2>
        <p className="text-gray-600 mt-2">
          Crawl runs and spend. Spend cards read the cost ledger; run rows show each run&apos;s own
          run total.
        </p>
      </div>
      <CrawlMonitorDashboard initialSummary={summary} initialRuns={runs} />
    </div>
  );
}
