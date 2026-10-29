// @vitest-environment node
/**
 * #96 D57: embeddings run in-process with bge-small. They must book no cost
 * event, make no network call, ignore the daily cap, and add the BGE query
 * instruction only on the query path. `@huggingface/transformers` is replaced
 * with a fake so these tests run without the 133 MB model; real-model parity
 * is `embeddings-parity.test.ts`.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { DAILY_COST_CAP_USD, resetCostAlertMemo } from '@/lib/costs/daily-cap';
import { COST_RATES } from '@/lib/costs/rates';
import { crawlCostEvents } from '@/lib/db/autonomous-scraper-schema';
import type { Recipe } from '@/lib/db/schema';
import { usageCounters } from '@/lib/db/usage-counters-schema';
import type { UsageDb } from '@/lib/rate-limit/counter';

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({
  get db() {
    return holder.db;
  },
}));

const fake = vi.hoisted(() => ({
  seenTexts: [] as string[][],
  env: {} as Record<string, unknown>,
  loadError: null as Error | null,
}));

vi.mock('@huggingface/transformers', () => {
  const tokenizer = Object.assign(
    (texts: string[]) => {
      fake.seenTexts.push(texts);
      const ones = () => ({
        data: new BigInt64Array(texts.length * 2).fill(BigInt(1)),
        dims: [texts.length, 2],
      });
      return { input_ids: ones(), attention_mask: ones() };
    },
    { sep_token_id: 102 }
  );
  const model = async (inputs: { input_ids: { dims: number[] } }) => {
    const rows = inputs.input_ids.dims[0];
    const vectors = Array.from({ length: rows }, () =>
      Array.from({ length: 384 }, () => 1 / Math.sqrt(384))
    );
    return {
      last_hidden_state: { slice: () => ({ normalize: () => ({ tolist: () => vectors }) }) },
    };
  };
  return {
    env: fake.env,
    pipeline: vi.fn(async () => {
      if (fake.loadError) throw fake.loadError;
      return { tokenizer, model };
    }),
  };
});

import {
  BGE_QUERY_PREFIX,
  generateEmbedding,
  generateEmbeddingsBatch,
  generateQueryEmbedding,
  generateRecipeEmbedding,
  resetEmbeddingModelForTests,
} from '../embeddings';

let client: PGlite;
let db: UsageDb;

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
  resetEmbeddingModelForTests();
  fake.seenTexts.length = 0;
  fake.loadError = null;
  vi.unstubAllGlobals();
});

describe('#96 D57 in-process bge-small embeddings', () => {
  it('books no cost event and makes no fetch call, even at the daily cap', async () => {
    await db.insert(crawlCostEvents).values({
      provider: 'jina',
      operation: 'reader',
      usd: DAILY_COST_CAP_USD.toFixed(6),
    });
    const fetchMock = vi.fn(async () => {
      throw new Error('network is not allowed during embedding');
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await generateEmbedding('pasta with garlic')).toHaveLength(384);
    expect(await generateQueryEmbedding('quick soup')).toHaveLength(384);
    expect(await generateEmbeddingsBatch(['a', 'b', 'c'], { batchSize: 2 })).toHaveLength(3);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await db.select().from(crawlCostEvents)).toHaveLength(1); // only the seeded row
    expect(COST_RATES['jina:embeddings']).toBeUndefined();
  });

  it('loads the model from local disk only', async () => {
    await generateEmbedding('soup');
    expect(fake.env.allowRemoteModels).toBe(false);
    expect(String(fake.env.localModelPath)).toMatch(/models$/);
  });

  it('generateQueryEmbedding prepends the BGE instruction', async () => {
    await generateQueryEmbedding('quick weeknight pasta');
    expect(fake.seenTexts).toEqual([[`${BGE_QUERY_PREFIX}quick weeknight pasta`]]);
  });

  it('generateEmbedding adds no prefix', async () => {
    await generateEmbedding('Banana bread');
    const result = await generateRecipeEmbedding({ name: 'Banana bread' } as Recipe);
    expect(fake.seenTexts).toEqual([['Banana bread'], ['Banana bread']]);
    expect(result.modelName).toBe('BAAI/bge-small-en-v1.5');
  });

  it('throws EmbeddingError when the model files are missing', async () => {
    fake.loadError = new Error('file was not found locally');
    const error = await generateEmbedding('pasta').catch((e) => e);
    expect(error.name).toBe('EmbeddingError');
    expect(error.code).toBe('CONFIG_ERROR');
    // A failed load is not cached: the next call retries and succeeds.
    fake.loadError = null;
    expect(await generateEmbedding('pasta')).toHaveLength(384);
  });
});
