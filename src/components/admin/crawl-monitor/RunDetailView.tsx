// #6: one discovery run's counts, items and cost for the crawl monitor (S4).

import type { DiscoveryRunDetail } from '@/app/actions/crawl-monitor';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CostBreakdownTables } from './CostTables';
import { COST_LABELS, formatCount, formatUsd, MISSING } from './format';

/**
 * Why: a run has two cost figures that can disagree, and admins must know
 * which one they are reading.
 * What: shows the run total (`run.cost_usd`, `—` when null) beside the ledger
 * sum, a warning when `cost_write_failures > 0` (the ledger then reads low),
 * counts, cost by provider and by provider+operation, the items and errors.
 * Test: `RunDetailView labels both cost figures and flags failed ledger writes`
 */
export function RunDetailView({ detail }: { detail: DiscoveryRunDetail }) {
  const { run, items, cost } = detail;
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
        <dt className="text-gray-500">Cost ({COST_LABELS.runTotal})</dt>
        <dd data-testid="run-total">{formatUsd(run.cost_usd)}</dd>
        <dt className="text-gray-500">Cost ({COST_LABELS.ledger})</dt>
        <dd data-testid="ledger-total">{formatUsd(cost.usd)}</dd>
        <dt className="text-gray-500">Budget</dt>
        <dd>{formatUsd(run.budget_usd)}</dd>
        <dt className="text-gray-500">URLs discovered</dt>
        <dd>{formatCount(run.urls_discovered)}</dd>
        <dt className="text-gray-500">Stored</dt>
        <dd>{formatCount(run.recipes_stored)}</dd>
        <dt className="text-gray-500">Skipped</dt>
        <dd>{formatCount(run.recipes_skipped)}</dd>
        <dt className="text-gray-500">Items</dt>
        <dd>
          {run.item_total === 0
            ? MISSING
            : Object.entries(run.item_counts)
                .map(([outcome, n]) => `${outcome}: ${n}`)
                .join(', ')}
        </dd>
      </dl>

      {run.cost_write_failures > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            {run.cost_write_failures} ledger write(s) failed for this run, so the{' '}
            {COST_LABELS.ledger} figure is lower than the {COST_LABELS.runTotal}.
          </AlertDescription>
        </Alert>
      )}

      <CostBreakdownTables breakdown={cost} />

      {items.length > 0 && (
        <Table aria-label="Run items">
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-xs truncate" title={item.url}>
                  {item.url}
                </TableCell>
                <TableCell>{item.extraction_tier}</TableCell>
                <TableCell>{item.outcome}</TableCell>
                <TableCell className="max-w-xs truncate" title={item.error ?? undefined}>
                  {item.error ?? MISSING}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {detail.items_truncated && (
        <p className="text-xs text-gray-500">Showing the first {items.length} items.</p>
      )}

      {run.errors.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-red-700">
          {run.errors.map((e, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: errors are append-only strings
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
