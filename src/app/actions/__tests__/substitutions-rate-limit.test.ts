// @vitest-environment node
/**
 * #17: getMultipleIngredientSubstitutions is rate limited on its paid AI path,
 * against the real usage_counters upsert (PGlite).
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  dbDown: false,
  create: vi.fn(),
  realClient: false,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ userId: null })) }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '203.0.113.7' }),
}));
vi.mock('@/lib/rate-limit/counter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit/counter')>()),
  defaultUsageDb: async () => {
    if (state.dbDown) throw new Error('relation "usage_counters" does not exist');
    return state.db;
  },
}));
// #57: `realClient` switches to the real getOpenRouterClient -> withChatCostTracking wrapper.
vi.mock('@/lib/ai/openrouter-server', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/ai/openrouter-server')>();
  return {
    ...real,
    getOpenRouterClient: () =>
      state.realClient
        ? real.getOpenRouterClient()
        : { chat: { completions: { create: state.create } } },
  };
});

import { crawlCostEvents } from '@/lib/db/autonomous-scraper-schema';
import { usageCounters } from '@/lib/db/usage-counters-schema';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getMultipleIngredientSubstitutions } from '../substitutions';
import { createVisibilityDb } from './recipe-visibility-db';

const { limit } = RATE_LIMITS.substitutions;
let client: PGlite;
let seq = 0;
/** A name absent from the static table and the AI cache, so it takes the AI path. */
// Letters only: normalizeIngredientName strips digits, so numbered names would share a cache entry.
const LETTERS = 'qwertyuiop';
const novel = () =>
  `zzqx ${String(++seq)
    .split('')
    .map((d) => LETTERS[Number(d)])
    .join('')}`;

beforeAll(async () => {
  const built = await createVisibilityDb(
    [usageCounters, crawlCostEvents],
    { usageCounters, crawlCostEvents },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "usage_counters"; DELETE FROM "crawl_cost_events";');
  state.dbDown = false;
  state.realClient = false;
  state.create.mockReset();
  state.create.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ substitutions: [] }) } }],
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('#17 getMultipleIngredientSubstitutions rate limit', () => {
  it('blocks after N AI-path calls and makes no AI call when blocked', async () => {
    for (let i = 0; i < limit; i++) {
      const result = await getMultipleIngredientSubstitutions([novel()]);
      expect(result.success).toBe(true);
    }
    const callsBefore = state.create.mock.calls.length;
    const over = await getMultipleIngredientSubstitutions([novel()]);
    expect(over).toMatchObject({ success: false, errorCode: 'RATE_LIMITED' });
    expect(state.create.mock.calls.length).toBe(callsBefore);
  });

  it('static hits are not counted', async () => {
    for (let i = 0; i < limit + 5; i++) {
      const result = await getMultipleIngredientSubstitutions(['butter']);
      expect(result.success).toBe(true);
    }
    const rows = await client.query('SELECT * FROM usage_counters');
    expect(rows.rows).toHaveLength(0);
    expect(state.create).not.toHaveBeenCalled();
  });

  it('returns LIMITER_UNAVAILABLE and makes no paid call when the limiter is down', async () => {
    state.dbDown = true;
    const result = await getMultipleIngredientSubstitutions([novel()]);
    expect(result).toMatchObject({ success: false, errorCode: 'LIMITER_UNAVAILABLE' });
    expect(state.create).not.toHaveBeenCalled();
  });
});

describe('#57 daily cap on the substitutions AI path', () => {
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('the $10 cap blocks the provider call through the real client wrapper', async () => {
    await (state.db as any).insert(crawlCostEvents).values({
      provider: 'openrouter',
      operation: 'chat:test',
      usd: '10.000000',
      created_at: new Date(),
    });
    state.realClient = true;
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
    const providerFetch = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', providerFetch);

    const result = await getMultipleIngredientSubstitutions([novel()]);

    expect(providerFetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false, errorCode: 'COST_CAP_REACHED' });
  });
});
