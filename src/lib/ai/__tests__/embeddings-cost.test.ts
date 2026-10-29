// @vitest-environment node
/**
 * #75: Jina embedding calls must book a non-zero cost into the ledger the
 * daily cap sums, and must be blocked once the cap is reached.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { DAILY_COST_CAP_USD, resetCostAlertMemo, todaysSpendUsd } from '@/lib/costs/daily-cap';
import { crawlCostEvents } from '@/lib/db/autonomous-scraper-schema';
import { usageCounters } from '@/lib/db/usage-counters-schema';
import type { UsageDb } from '@/lib/rate-limit/counter';

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({
  get db() {
    return holder.db;
  },
}));

import { generateEmbedding } from '../embeddings';

let client: PGlite;
let db: UsageDb;
const vector = Array.from({ length: 384 }, (_, i) => (i + 1) / 384);

function jinaResponse(usage?: { total_tokens: number }): Response {
  return new Response(JSON.stringify({ data: [{ index: 0, embedding: vector }], usage }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [crawlCostEvents, usageCounters],
    { crawlCostEvents, usageCounters },
    { constraints: true }
  );
  client = built.client;
  db = built.db as unknown as UsageDb;
  holder.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "crawl_cost_events"; DELETE FROM "usage_counters";');
  resetCostAlertMemo();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.stubEnv('JINA_API_KEY', 'test-key');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('#75 Jina embedding cost', () => {
  it('a Jina call adds its token cost to today', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jinaResponse({ total_tokens: 8 }))
    );
    await generateEmbedding('pasta with garlic');
    expect(await todaysSpendUsd(db, new Date())).toBeGreaterThan(0);
  });

  it('a Jina call with no usage still records a non-zero cost', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jinaResponse())
    );
    await generateEmbedding('soup');
    const rows = await db.select().from(crawlCostEvents);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.usd)).toBeGreaterThan(0);
  });

  it('blocks the next Jina call before the provider once spend reaches the cap', async () => {
    await db.insert(crawlCostEvents).values({
      provider: 'jina',
      operation: 'embeddings',
      usd: DAILY_COST_CAP_USD.toFixed(6),
    });
    const fetchMock = vi.fn(async () => jinaResponse({ total_tokens: 8 }));
    vi.stubGlobal('fetch', fetchMock);
    const error = await generateEmbedding('pasta').catch((e) => e);
    expect(error.code).toBe('COST_CAP_REACHED');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
