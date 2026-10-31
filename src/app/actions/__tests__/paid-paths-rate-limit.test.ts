// @vitest-environment node
/**
 * Every signed-in paid entry point is rate limited before its provider call,
 * against the real usage_counters upsert (PGlite). One table row per entry point:
 * call N+1 in a window is refused with no provider call, and a limiter outage
 * refuses the first call (fail closed).
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Provider = 'llm' | 'firecrawl' | 'brave' | 'parser' | 'generator' | 'recommender';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  usageDb: undefined as unknown,
  dbDown: false,
  capReached: false,
  calls: [] as string[],
}));

/** Records a provider call; with the daily cap reached it throws as the real guard does. */
const providerCall = vi.hoisted(() => async (name: string) => {
  state.calls.push(name);
  if (state.capReached) {
    const { PaidCallBlockedError } = await import('@/lib/costs/daily-cap');
    throw new PaidCallBlockedError('COST_CAP_REACHED', 'Daily cost cap reached');
  }
});

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '203.0.113.9' }),
}));
vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => 'user-paid-1',
  getSessionUser: async () => ({ id: 'user-paid-1' }),
}));
// #233: POST /api/ingest-recipe is admin-only, so the caller is an admin.
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => true }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/rate-limit/counter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit/counter')>()),
  defaultUsageDb: async () => {
    if (state.dbDown) throw new Error('relation "usage_counters" does not exist');
    return state.usageDb;
  },
}));
// The daily-cap guard and ledger have their own PGlite tests.
vi.mock('@/lib/costs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/costs')>()),
  assertWithinDailyCap: vi.fn(async () => 0),
  trackCost: vi.fn(async () => undefined),
}));
vi.mock('@/lib/ai/openrouter-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/openrouter-server')>()),
  getOpenRouterClient: () => ({
    chat: {
      completions: {
        create: async () => {
          await providerCall('llm');
          return { choices: [{ message: { content: '{}' } }] };
        },
      },
    },
  }),
}));
vi.mock('@/lib/ai/recipe-generator', () => ({
  generateRecipe: async () => {
    await providerCall('generator');
    return { name: 'Stub' };
  },
}));
vi.mock('@/lib/ai/recipe-parser', () => {
  const parse = async () => {
    await providerCall('parser');
    throw new Error('parse stub');
  };
  return { parseRecipeWithAI: parse, parseRecipeFromImage: parse };
});
vi.mock('@/lib/ai/recipe-ingestion-parser', () => ({
  parseRecipeForIngestion: async () => {
    await providerCall('parser');
    throw new Error('parse stub');
  },
}));
vi.mock('@/lib/firecrawl', () => ({
  scrapeRecipePage: async () => {
    await providerCall('firecrawl');
    return { success: false, error: 'scrape stub' };
  },
}));
vi.mock('@/lib/brave-search', () => ({
  searchRecipes: async () => {
    await providerCall('brave');
    return [];
  },
}));
vi.mock('@/lib/ai/meal-recommendations', () => ({
  generateMealRecommendations: async () => {
    await providerCall('recommender');
    return {};
  },
}));
vi.mock('@/lib/ai/embeddings', () => ({ generateRecipeEmbedding: vi.fn() }));
vi.mock('@/lib/db/embeddings', () => ({ saveRecipeEmbedding: vi.fn() }));
// API-key auth: the handler receives an API key context.
vi.mock('@/lib/api-auth/require-auth', () => ({
  requireScopes:
    (_scopes: string[], handler: (...args: unknown[]) => unknown) =>
    (request: unknown, context: unknown) =>
      handler(
        request,
        { authenticated: true, userId: 'user-paid-1', apiKeyId: 'key-1', scopes: [] },
        context
      ),
}));

import { recipes } from '@/lib/db/schema';
import { usageCounters } from '@/lib/db/usage-counters-schema';
import { RATE_LIMITS, type RateLimitBucket } from '@/lib/rate-limit';
import { POST as braveSearchPost } from '../../api/brave-search/route';
import { POST as ingestRecipePost } from '../../api/ingest-recipe/route';
import { discoverRecipe } from '../ai-recipes';
import { previewRecipeParse, uploadRecipeFromUrl, uploadRecipeWithAI } from '../ai-upload';
import { getRecipeRecommendations } from '../meals';
import { discoverRecipeFromUrl, discoverRecipes } from '../recipe-discovery';
import { parseRecipeFromUrl, searchWebRecipes } from '../recipe-search';
import { createVisibilityDb } from './recipe-visibility-db';

const MAIN_RECIPE = '11111111-1111-4111-8111-111111111111';
const post = (url: string, body: unknown) =>
  new NextRequest(url, { method: 'POST', body: JSON.stringify(body) });

interface EntryPoint {
  name: string;
  bucket: RateLimitBucket;
  provider: Provider;
  run: () => Promise<unknown>;
}

const ENTRY_POINTS: EntryPoint[] = [
  {
    name: 'discoverRecipe',
    bucket: 'recipe-generation',
    provider: 'generator',
    run: () => discoverRecipe({ query: 'soup' }),
  },
  {
    name: 'uploadRecipeWithAI',
    bucket: 'recipe-parse',
    provider: 'parser',
    run: () => uploadRecipeWithAI({ text: 'soup' }),
  },
  {
    name: 'previewRecipeParse',
    bucket: 'recipe-parse',
    provider: 'parser',
    run: () => previewRecipeParse({ text: 'soup' }),
  },
  {
    name: 'uploadRecipeFromUrl',
    bucket: 'recipe-url-import',
    provider: 'firecrawl',
    run: () => uploadRecipeFromUrl('https://example.com/soup'),
  },
  {
    name: 'searchWebRecipes',
    bucket: 'web-recipe-search',
    provider: 'llm',
    run: () => searchWebRecipes({ query: 'soup' }),
  },
  {
    name: 'parseRecipeFromUrl',
    bucket: 'recipe-url-import',
    provider: 'llm',
    run: () => parseRecipeFromUrl('https://example.com/soup'),
  },
  {
    name: 'discoverRecipes',
    bucket: 'recipe-discovery',
    provider: 'brave',
    run: () => discoverRecipes('soup'),
  },
  {
    name: 'discoverRecipeFromUrl',
    bucket: 'recipe-url-import',
    provider: 'llm',
    run: () => discoverRecipeFromUrl('https://example.com/soup'),
  },
  {
    name: 'getRecipeRecommendations',
    bucket: 'meal-recommendations',
    provider: 'recommender',
    run: () => getRecipeRecommendations(MAIN_RECIPE),
  },
  {
    name: 'POST /api/brave-search',
    bucket: 'brave-search',
    provider: 'brave',
    run: () => braveSearchPost(post('http://localhost/api/brave-search', { query: 'soup' })),
  },
  {
    name: 'POST /api/ingest-recipe',
    bucket: 'recipe-ingest-api',
    provider: 'firecrawl',
    run: () =>
      (ingestRecipePost as (r: NextRequest, c: unknown) => Promise<Response>)(
        post('http://localhost/api/ingest-recipe', { url: 'https://example.com/soup' }),
        { params: Promise.resolve({}) }
      ),
  },
];

/** Error code and HTTP status of an action result or a route Response. */
async function outcome(
  result: unknown
): Promise<{ errorCode?: string; status?: number; retryAfter?: string | null }> {
  if (result instanceof Response) {
    const body = (await result.clone().json()) as { errorCode?: string };
    return {
      errorCode: body.errorCode,
      status: result.status,
      retryAfter: result.headers.get('Retry-After'),
    };
  }
  return { errorCode: (result as { errorCode?: string }).errorCode };
}

const providerCalls = (provider: Provider) => state.calls.filter((c) => c === provider).length;

let usageClient: PGlite;
let appClient: PGlite;

beforeAll(async () => {
  const usage = await createVisibilityDb([usageCounters], { usageCounters }, { constraints: true });
  usageClient = usage.client;
  state.usageDb = usage.db;
  const app = await createVisibilityDb([recipes], { recipes });
  appClient = app.client;
  state.db = app.db;
  await app.db
    .insert(recipes)
    .values({ id: MAIN_RECIPE, user_id: 'user-paid-1', name: 'Stew', is_public: true } as never);
});

afterAll(async () => {
  await usageClient?.close();
  await appClient?.close();
});

beforeEach(async () => {
  await usageClient.exec('DELETE FROM "usage_counters";');
  state.dbDown = false;
  state.capReached = false;
  state.calls = [];
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-key');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL) => {
      if (String(url).includes('api.search.brave.com')) {
        await providerCall('brave');
        return new Response(JSON.stringify({ web: { results: [] } }), { status: 200 });
      }
      return new Response(`<p>${'recipe text '.repeat(20)}</p>`, { status: 200 });
    })
  );
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe.each(ENTRY_POINTS)('$name rate limit', ({ bucket, provider, run }) => {
  const { limit } = RATE_LIMITS[bucket];

  it('allows N calls per window and refuses call N+1 before the provider call', async () => {
    for (let i = 0; i < limit; i++) {
      expect((await outcome(await run())).errorCode).toBeUndefined();
    }
    expect(providerCalls(provider)).toBe(limit);

    const over = await outcome(await run());
    expect(over.errorCode).toBe('RATE_LIMITED');
    if (over.status !== undefined) expect(over.status).toBe(429);
    if (over.retryAfter !== undefined) expect(Number(over.retryAfter)).toBeGreaterThan(0);
    expect(providerCalls(provider)).toBe(limit);
  });

  it('returns the cost-ceiling code from a refused provider call', async () => {
    state.capReached = true;
    const blocked = await outcome(await run());
    expect(blocked.errorCode).toBe('COST_CAP_REACHED');
    if (blocked.status !== undefined) expect(blocked.status).toBe(503);
  });

  it('fails closed with LIMITER_UNAVAILABLE and no provider call when the limiter is down', async () => {
    state.dbDown = true;
    const down = await outcome(await run());
    expect(down.errorCode).toBe('LIMITER_UNAVAILABLE');
    if (down.status !== undefined) expect(down.status).toBe(503);
    expect(state.calls).toEqual([]);
  });
});
