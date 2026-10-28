'use client';

// #6: ledger spend totals and breakdown tables for the crawl monitor (S4).
// Totals only, no chart (#6 Q3).

import { useState } from 'react';
import type { CostBreakdown, CostSummary } from '@/app/actions/crawl-monitor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { COST_LABELS, formatCount, formatUsd, formatUtc } from './format';

/** Spend by provider, then by (provider, operation), for one breakdown. */
export function CostBreakdownTables({ breakdown }: { breakdown: CostBreakdown }) {
  if (breakdown.events === 0) {
    return <p className="text-sm text-gray-500">No {COST_LABELS.ledger} cost events.</p>;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Table aria-label="Cost by provider">
        <TableHeader>
          <TableRow>
            <TableHead>Provider</TableHead>
            <TableHead className="text-right">Calls</TableHead>
            <TableHead className="text-right">USD ({COST_LABELS.ledger})</TableHead>
            <TableHead className="text-right">Estimated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {breakdown.byProvider.map((p) => (
            <TableRow key={p.provider}>
              <TableCell>{p.provider}</TableCell>
              <TableCell className="text-right">{formatCount(p.events)}</TableCell>
              <TableCell className="text-right">{formatUsd(p.usd)}</TableCell>
              <TableCell className="text-right">{formatUsd(p.estimatedUsd)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Table aria-label="Cost by provider and operation">
        <TableHeader>
          <TableRow>
            <TableHead>Provider</TableHead>
            <TableHead>Operation</TableHead>
            <TableHead className="text-right">Calls</TableHead>
            <TableHead className="text-right">USD ({COST_LABELS.ledger})</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {breakdown.byOperation.map((o) => (
            <TableRow key={`${o.provider}/${o.operation}`}>
              <TableCell>{o.provider}</TableCell>
              <TableCell>{o.operation}</TableCell>
              <TableCell className="text-right">{formatCount(o.events)}</TableCell>
              <TableCell className="text-right">{formatUsd(o.usd)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const PERIODS = [
  { key: 'today', title: 'Today' },
  { key: 'month', title: 'This month' },
  { key: 'allTime', title: 'All time' },
] as const;
type PeriodKey = (typeof PERIODS)[number]['key'];

/** Three spend cards (UTC periods) and the breakdown for the selected one. */
export function CostSummaryPanel({ summary }: { summary: CostSummary }) {
  const [period, setPeriod] = useState<PeriodKey>('today');
  return (
    <section className="space-y-4" aria-label="Crawl spend">
      <div className="grid gap-4 md:grid-cols-3">
        {PERIODS.map(({ key, title }) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Spend {title.toLowerCase()} ({COST_LABELS.ledger})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatUsd(summary[key].usd)}</div>
              <p className="text-xs text-gray-500">
                {formatCount(summary[key].events)} calls, {formatUsd(summary[key].estimatedUsd)}{' '}
                estimated
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Periods start at UTC midnight: today from {formatUtc(summary.todayStart)}, month from{' '}
        {formatUtc(summary.monthStart)}.
      </p>
      <div className="flex gap-2">
        {PERIODS.map(({ key, title }) => (
          <Button
            key={key}
            size="sm"
            variant={period === key ? 'default' : 'outline'}
            onClick={() => setPeriod(key)}
          >
            {title}
          </Button>
        ))}
      </div>
      <CostBreakdownTables breakdown={summary[period]} />
    </section>
  );
}
