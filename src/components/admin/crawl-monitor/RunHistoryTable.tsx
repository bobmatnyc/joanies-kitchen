'use client';

// #6: run history table with expandable run detail for the crawl monitor (S4).

import { Fragment, useState } from 'react';
import {
  type DiscoveryRunDetail,
  getCrawlRunDetail,
  type Paged,
  type UnifiedRun,
} from '@/app/actions/crawl-monitor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { COST_LABELS, formatCount, formatUsd, formatUtc } from './format';
import { RunDetailView } from './RunDetailView';

type DetailState =
  | { status: 'loading' }
  | { status: 'loaded'; detail: DiscoveryRunDetail | null }
  | { status: 'error'; message: string };

const SOURCE_LABEL: Record<UnifiedRun['source'], string> = {
  discovery: 'Discovery',
  scraping_job: 'Chef scrape',
};

/**
 * Why: admins page through runs and drill into one without leaving the page.
 * What: one row per `UnifiedRun`; null counts and null cost render as `—`.
 * The cost column is the run total (`cost_usd`), labelled as such. Discovery
 * rows expand to `RunDetailView`, fetched on first expand; scraping jobs have
 * no detail. Prev/next call `onPage`; next is enabled only when `hasMore`.
 * Test: `RunHistoryTable renders null counts as a dash and labels the run total`
 */
export function RunHistoryTable({
  runs,
  loading,
  onPage,
}: {
  runs: Paged<UnifiedRun>;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  const [open, setOpen] = useState<Record<string, DetailState>>({});

  async function toggle(id: string) {
    if (open[id]) {
      setOpen(({ [id]: _closed, ...rest }) => rest);
      return;
    }
    setOpen((s) => ({ ...s, [id]: { status: 'loading' } }));
    try {
      const detail = await getCrawlRunDetail(id);
      setOpen((s) => ({ ...s, [id]: { status: 'loaded', detail } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load run';
      setOpen((s) => ({ ...s, [id]: { status: 'error', message } }));
    }
  }

  return (
    <div className="space-y-3">
      <Table aria-label="Run history">
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Finished</TableHead>
            <TableHead className="text-right">Succeeded</TableHead>
            <TableHead className="text-right">Failed</TableHead>
            <TableHead className="text-right">Skipped</TableHead>
            <TableHead className="text-right">Cost ({COST_LABELS.runTotal})</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-gray-500">
                No runs on this page.
              </TableCell>
            </TableRow>
          )}
          {runs.rows.map((run) => {
            const key = `${run.source}:${run.id}`;
            const state = open[run.id];
            return (
              <Fragment key={key}>
                <TableRow data-testid={`run-row-${run.id}`}>
                  <TableCell>{SOURCE_LABEL[run.source]}</TableCell>
                  <TableCell className="max-w-xs truncate" title={run.label}>
                    {run.label}
                  </TableCell>
                  <TableCell>
                    <Badge variant={run.status === 'failed' ? 'destructive' : 'secondary'}>
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatUtc(run.started_at)}</TableCell>
                  <TableCell>{formatUtc(run.finished_at)}</TableCell>
                  <TableCell className="text-right">{formatCount(run.items.succeeded)}</TableCell>
                  <TableCell className="text-right">{formatCount(run.items.failed)}</TableCell>
                  <TableCell className="text-right">{formatCount(run.items.skipped)}</TableCell>
                  <TableCell className="text-right">{formatUsd(run.cost_usd)}</TableCell>
                  <TableCell>
                    {run.source === 'discovery' && (
                      <Button size="sm" variant="ghost" onClick={() => toggle(run.id)}>
                        {state ? 'Hide' : 'Details'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                {state && (
                  <TableRow>
                    <TableCell colSpan={10} className="bg-gray-50">
                      {state.status === 'loading' && <p>Loading run…</p>}
                      {state.status === 'error' && <p className="text-red-700">{state.message}</p>}
                      {state.status === 'loaded' &&
                        (state.detail ? (
                          <RunDetailView detail={state.detail} />
                        ) : (
                          <p>Run not found.</p>
                        ))}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">Page {runs.page}</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={loading || runs.page <= 1}
            onClick={() => onPage(runs.page - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || !runs.hasMore}
            onClick={() => onPage(runs.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
