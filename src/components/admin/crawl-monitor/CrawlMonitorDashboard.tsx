'use client';

// #6: client shell of /admin/crawl-monitor (S4): spend, running job, history, trigger.

import { useCallback, useEffect, useState } from 'react';
import {
  type CostSummary,
  getCrawlCostSummary,
  getUnifiedCrawlRuns,
  type Paged,
  type UnifiedRun,
} from '@/app/actions/crawl-monitor';
import { triggerManualCrawl } from '@/app/actions/crawl-trigger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CostSummaryPanel } from './CostTables';
import { COST_LABELS, formatElapsed, formatUsd, formatUtc, RUNS_PAGE_SIZE } from './format';
import { RunHistoryTable } from './RunHistoryTable';
import { POLL_INTERVAL_MS, START_GRACE_MS, useRunningPoll } from './use-running-poll';

export const TRIGGER_CONFIRM_TEXT =
  'Start a manual recipe crawl now? It makes paid API calls (Tavily, Firecrawl, OpenRouter) up to the per-run budget.';

const isRunning = (r: UnifiedRun) => r.status === 'running';

/**
 * Why: one admin view of what the crawler is doing and what it has spent.
 * What: renders server-fetched initial data, then polls page 1 of the
 * unified runs via `useRunningPoll` while a run is live (or just triggered).
 * When the last running row finishes, it refreshes spend and the history
 * page once. The trigger asks for confirmation and is disabled while a run
 * is live, a trigger is in flight, or a triggered run has not appeared yet.
 * Test: `CrawlMonitorDashboard confirms before triggering and disables while running`
 */
export function CrawlMonitorDashboard({
  initialSummary,
  initialRuns,
}: {
  initialSummary: CostSummary;
  initialRuns: Paged<UnifiedRun>;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [runs, setRuns] = useState(initialRuns);
  const [running, setRunning] = useState<UnifiedRun[]>(
    initialRuns.page === 1 ? initialRuns.rows.filter(isRunning) : []
  );
  const [loadingPage, setLoadingPage] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [awaitingStart, setAwaitingStart] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadPage = useCallback(async (page: number) => {
    setLoadingPage(true);
    try {
      setRuns(await getUnifiedCrawlRuns({ page, pageSize: RUNS_PAGE_SIZE }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load runs');
    } finally {
      setLoadingPage(false);
    }
  }, []);

  const tick = useCallback(async () => {
    try {
      const first = await getUnifiedCrawlRuns({ page: 1, pageSize: RUNS_PAGE_SIZE });
      const live = first.rows.filter(isRunning);
      setNow(Date.now());
      if (live.length > 0) setAwaitingStart(false);
      const finished = running.length > 0 && live.length === 0;
      setRunning(live);
      if (runs.page === 1) setRuns(first);
      if (finished) {
        setSummary(await getCrawlCostSummary());
        if (runs.page !== 1) await loadPage(runs.page);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Refresh failed');
    }
  }, [running.length, runs.page, loadPage]);

  // A triggered run that never shows up stops being awaited after the grace.
  useEffect(() => {
    if (!awaitingStart) return;
    const id = setTimeout(() => setAwaitingStart(false), START_GRACE_MS);
    return () => clearTimeout(id);
  }, [awaitingStart]);

  const { polling, hidden } = useRunningPoll({
    running: running.length > 0,
    awaitingStart,
    onTick: tick,
  });

  const busy = triggering || running.length > 0 || awaitingStart;

  async function onTrigger() {
    if (!window.confirm(TRIGGER_CONFIRM_TEXT)) return;
    setTriggering(true);
    setMessage(null);
    try {
      const result = await triggerManualCrawl();
      if (result.started) {
        setAwaitingStart(true);
        setMessage('Crawl started. This panel refreshes while it runs.');
      } else {
        setMessage(result.reason);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to start crawl');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="space-y-8">
      <CostSummaryPanel summary={summary} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Current run</CardTitle>
          <Button onClick={onTrigger} disabled={busy}>
            {triggering ? 'Starting…' : busy ? 'Crawl in progress' : 'Run crawl now'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {message && <p aria-live="polite">{message}</p>}
          {running.length === 0 ? (
            <p className="text-gray-500">
              {awaitingStart ? 'Waiting for the new run to start…' : 'No run in progress.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {running.map((r) => (
                <li key={`${r.source}:${r.id}`}>
                  <span className="font-medium">{r.label}</span> — started {formatUtc(r.started_at)}{' '}
                  ({formatElapsed(r.started_at, now)} ago), {COST_LABELS.runTotal}{' '}
                  {formatUsd(r.cost_usd)}
                </li>
              ))}
            </ul>
          )}
          {polling && (
            <p className="text-xs text-gray-500">Refreshing every {POLL_INTERVAL_MS / 1000} s.</p>
          )}
          {hidden && (running.length > 0 || awaitingStart) && (
            <p className="text-xs text-gray-500">Refresh paused while this tab is hidden.</p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Run history</h3>
        <RunHistoryTable runs={runs} loading={loadingPage} onPage={loadPage} />
      </section>
    </div>
  );
}
