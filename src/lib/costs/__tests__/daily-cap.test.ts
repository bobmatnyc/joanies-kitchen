// @vitest-environment node
/**
 * #57: daily cost ceiling over the real ledger and counter tables (PGlite).
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { crawlCostEvents } from '@/lib/db/autonomous-scraper-schema';
import { usageCounters } from '@/lib/db/usage-counters-schema';
import type { UsageDb } from '@/lib/rate-limit/counter';
import {
  assertWithinDailyCap,
  COST_ALERT_TAG,
  DAILY_COST_CAP_USD,
  PaidCallBlockedError,
  resetCostAlertMemo,
  todaysSpendUsd,
} from '../daily-cap';

let client: PGlite;
let db: UsageDb;
const NOW = new Date('2026-10-28T15:00:00Z');

beforeAll(async () => {
  const built = await createVisibilityDb(
    [crawlCostEvents, usageCounters],
    { crawlCostEvents, usageCounters },
    { constraints: true }
  );
  client = built.client;
  db = built.db as unknown as UsageDb;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "crawl_cost_events"; DELETE FROM "usage_counters";');
  resetCostAlertMemo();
  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

async function spend(usd: number, at: Date = NOW) {
  await db.insert(crawlCostEvents).values({
    provider: 'tavily',
    operation: 'search.basic',
    usd: usd.toFixed(6),
    created_at: at,
  });
}

const alertLines = () =>
  vi
    .mocked(console.error)
    .mock.calls.filter(([line]) => typeof line === 'string' && line.startsWith(COST_ALERT_TAG))
    .map(([line]) => line as string);

describe('#57 daily cost ceiling', () => {
  it("sums only today's UTC spend", async () => {
    await spend(3);
    await spend(4, new Date('2026-10-27T23:59:59Z'));
    expect(await todaysSpendUsd(db, NOW)).toBeCloseTo(3);
  });

  it('allows a paid call below the cap', async () => {
    await spend(9.99);
    await expect(assertWithinDailyCap({ db, now: NOW })).resolves.toBeCloseTo(9.99);
  });

  it('the guard blocks at $10', async () => {
    await spend(DAILY_COST_CAP_USD);
    const error = await assertWithinDailyCap({ db, now: NOW }).catch((e) => e);
    expect(error).toBeInstanceOf(PaidCallBlockedError);
    expect(error.code).toBe('COST_CAP_REACHED');
  });

  it('the guard blocks when the spend query errors', async () => {
    const broken = {
      select: () => {
        throw new Error('neon down');
      },
    } as unknown as UsageDb;
    const error = await assertWithinDailyCap({ db: broken, now: NOW }).catch((e) => e);
    expect(error).toBeInstanceOf(PaidCallBlockedError);
    expect(error.code).toBe('COST_GUARD_UNAVAILABLE');
    expect(console.error).toHaveBeenCalledWith(
      '[CostCap] spend query failed; blocking paid call:',
      expect.any(Error)
    );
  });

  it('the alert fires once per threshold per day', async () => {
    await spend(8);
    await assertWithinDailyCap({ db, now: NOW });
    await assertWithinDailyCap({ db, now: NOW });
    // A second instance (no memo) must not re-alert: the counter dedupes.
    resetCostAlertMemo();
    await assertWithinDailyCap({ db, now: NOW });
    expect(alertLines()).toHaveLength(1);
    expect(alertLines()[0]).toContain('threshold=80%');

    await spend(2);
    for (let i = 0; i < 3; i++) await assertWithinDailyCap({ db, now: NOW }).catch(() => undefined);
    expect(alertLines()).toHaveLength(2);
    expect(alertLines()[1]).toContain('threshold=100%');

    // Next UTC day: fresh thresholds.
    const tomorrow = new Date('2026-10-29T01:00:00Z');
    await spend(10, tomorrow);
    await assertWithinDailyCap({ db, now: tomorrow }).catch(() => undefined);
    expect(alertLines()).toHaveLength(4);
  });

  it('an alert dedupe failure is logged and the cap still blocks', async () => {
    await spend(DAILY_COST_CAP_USD);
    const failingInsert = {
      select: db.select.bind(db),
      insert: () => {
        throw new Error('counter down');
      },
    } as unknown as UsageDb;
    const error = await assertWithinDailyCap({ db: failingInsert, now: NOW }).catch((e) => e);
    expect(error.code).toBe('COST_CAP_REACHED');
    expect(alertLines()).toHaveLength(0);
  });
});
