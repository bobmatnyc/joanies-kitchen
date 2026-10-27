/**
 * Per-run budget resolution and in-memory spend (#6 S2).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    insert: () => ({
      values: async () => {
        throw new Error('ledger insert failed: connection refused');
      },
    }),
  },
}));
vi.mock('@/lib/db/autonomous-scraper-schema', () => ({ crawlCostEvents: {} }));

import {
  currentRunSpend,
  DEFAULT_RUN_BUDGET_USD,
  resolveRunBudget,
  trackCost,
  withCostRun,
} from '@/lib/costs';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveRunBudget', () => {
  it('resolveRunBudget prefers the parameter, then the env var', () => {
    expect(resolveRunBudget(2, '7')).toBe(2);
    expect(resolveRunBudget(undefined, '7')).toBe(7);
    expect(resolveRunBudget(undefined, undefined)).toBe(DEFAULT_RUN_BUDGET_USD);
    expect(DEFAULT_RUN_BUDGET_USD).toBe(5);
  });

  it('resolveRunBudget falls back to the default for unusable values', () => {
    // A run is never unbudgeted: Infinity, NaN, 0, negatives and junk all fall back.
    for (const bad of [Number.POSITIVE_INFINITY, Number.NaN, 0, -1]) {
      expect(resolveRunBudget(bad, undefined)).toBe(DEFAULT_RUN_BUDGET_USD);
    }
    for (const bad of ['', '  ', 'Infinity', 'abc', '0', '-3']) {
      expect(resolveRunBudget(undefined, bad)).toBe(DEFAULT_RUN_BUDGET_USD);
    }
    expect(resolveRunBudget(Number.NaN, '2.5')).toBe(2.5);
  });
});

describe('currentRunSpend', () => {
  it('currentRunSpend counts spend and write failures when the ledger insert throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const spend = await withCostRun(async () => {
      await trackCost({ provider: 'firecrawl', operation: 'scrape', measuredUsd: 0.25 });
      await trackCost({ provider: 'tavily', operation: 'search.basic', measuredUsd: 0.5 });
      return currentRunSpend();
    });

    expect(spend).toEqual({ spentUsd: 0.75, writeFailures: 2 });
    expect(currentRunSpend()).toBeNull();
  });
});
