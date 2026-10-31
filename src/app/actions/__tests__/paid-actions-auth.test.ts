/**
 * #13: server actions that start paid work run only for the caller class
 * that legitimately uses them. A server action is callable by anyone who can
 * load a page importing it, so the check lives in the action, not the page.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sessionUserId: vi.fn(),
  adminFlag: vi.fn(),
  discoverWeeklyRecipes: vi.fn(),
  searchRecipesWithSerpAPI: vi.fn(),
  scrapeRecipePage: vi.fn(),
  llmCreate: vi.fn(),
  embed: vi.fn(),
  dbWrite: vi.fn(),
}));

vi.mock('@/lib/session-user', () => ({ getSessionUserId: mocks.sessionUserId }));
// The limiter has its own PGlite tests (paid-paths-rate-limit); allow every call here.
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  enforceRateLimit: vi.fn(async () => ({ allowed: true, count: 1, limit: 30 })),
}));
// #22: admin is read from users.is_admin; `mocks.adminFlag` stands in for that row.
vi.mock('@/lib/auth-users', () => ({
  getUserAdminFlag: mocks.adminFlag,
}));
vi.mock('@/lib/perplexity-discovery', () => ({
  discoverWeeklyRecipes: mocks.discoverWeeklyRecipes,
}));
vi.mock('@/lib/serpapi', () => ({
  searchRecipesWithSerpAPI: mocks.searchRecipesWithSerpAPI,
  filterRecipeSites: (r: unknown[]) => r,
}));
vi.mock('@/lib/firecrawl', () => ({ scrapeRecipePage: mocks.scrapeRecipePage }));
vi.mock('@/lib/ai/openrouter-server', () => ({
  getOpenRouterClient: () => ({ chat: { completions: { create: mocks.llmCreate } } }),
  MODELS: { PERPLEXITY_SONAR: 'perplexity/sonar' },
}));
vi.mock('@/lib/ai/embeddings', () => ({
  generateRecipeEmbedding: mocks.embed,
  generateEmbedding: mocks.embed,
  generateQueryEmbedding: mocks.embed, // #96 D57
}));
vi.mock('@/lib/ai/recipe-quality-evaluator', () => ({ evaluateRecipeQuality: mocks.llmCreate }));
vi.mock('@/lib/db', () => ({
  db: { insert: mocks.dbWrite, update: mocks.dbWrite, delete: mocks.dbWrite },
}));
vi.mock('@/lib/db/embeddings', () => ({ saveRecipeEmbedding: mocks.dbWrite }));
vi.mock('@/app/actions/recipes', () => ({ createRecipe: mocks.dbWrite }));

import * as crawlActions from '@/app/actions/recipe-crawl';
import * as searchActions from '@/app/actions/recipe-search';

const ROOT = path.resolve(__dirname, '../../../..');
const fetchSpy = vi.fn();

function signedOut() {
  mocks.sessionUserId.mockResolvedValue(null);
}

function signedIn(isAdmin: string | undefined) {
  mocks.sessionUserId.mockResolvedValue('user_1');
  mocks.adminFlag.mockResolvedValue(isAdmin === 'true');
}

function expectNoPaidWork() {
  expect(mocks.discoverWeeklyRecipes).not.toHaveBeenCalled();
  expect(mocks.searchRecipesWithSerpAPI).not.toHaveBeenCalled();
  expect(mocks.scrapeRecipePage).not.toHaveBeenCalled();
  expect(mocks.llmCreate).not.toHaveBeenCalled();
  expect(mocks.embed).not.toHaveBeenCalled();
  expect(mocks.dbWrite).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', fetchSpy);
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  mocks.discoverWeeklyRecipes.mockResolvedValue({ success: true, recipes: [] });
  mocks.searchRecipesWithSerpAPI.mockResolvedValue({ success: true, results: [] });
  mocks.scrapeRecipePage.mockResolvedValue({ markdown: '' });
  mocks.llmCreate.mockResolvedValue({ choices: [{ message: { content: '{"recipes":[]}' } }] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('/test-crawl page', () => {
  it('no longer exists; the crawl panel is served only under /admin/crawl', () => {
    expect(existsSync(path.join(ROOT, 'src/app/test-crawl/page.tsx'))).toBe(false);
    expect(existsSync(path.join(ROOT, 'src/app/admin/crawl/page.tsx'))).toBe(true);
  });
});

interface AdminAction {
  name: string;
  run: () => Promise<unknown>;
  paidWork: () => unknown;
}

const ADMIN_ACTIONS: AdminAction[] = [
  {
    name: 'crawlWeeklyRecipes',
    run: () => crawlActions.crawlWeeklyRecipes(0, { maxResults: 1 }),
    paidWork: () => mocks.discoverWeeklyRecipes,
  },
  {
    name: 'crawlAndStoreRecipes',
    run: () => crawlActions.crawlAndStoreRecipes('pasta', { maxResults: 1 }),
    paidWork: () => mocks.searchRecipesWithSerpAPI,
  },
  {
    name: 'convertUrlToRecipe',
    run: () => crawlActions.convertUrlToRecipe('https://example.com/recipe'),
    paidWork: () => mocks.scrapeRecipePage,
  },
];

describe.each(ADMIN_ACTIONS)('$name (admin-only action)', (action) => {
  it('rejects a signed-out caller before any paid work', async () => {
    signedOut();
    await expect(action.run()).rejects.toThrow('Admin access required');
    expectNoPaidWork();
  });

  it('rejects a signed-in non-admin before any paid work', async () => {
    signedIn('false');
    await expect(action.run()).rejects.toThrow('Admin access required');
    expectNoPaidWork();
  });

  it('rejects before any paid work when the auth check throws', async () => {
    mocks.sessionUserId.mockRejectedValue(new Error('auth unavailable'));
    await expect(action.run()).rejects.toThrow();
    expectNoPaidWork();
  });

  it('runs for a signed-in admin', async () => {
    signedIn('true');
    await action.run();
    expect(action.paidWork()).toHaveBeenCalledTimes(1);
  });
});

describe('internal-only crawl steps', () => {
  it.each(['searchRecipesOnline', 'storeRecipe', 'validateRecipe'])(
    '%s is not exported as a client-callable server action',
    (name) => {
      expect(name in crawlActions).toBe(false);
    }
  );
});

interface SignedInAction {
  name: string;
  run: () => Promise<{ success: boolean; error?: string }>;
}

const SIGNED_IN_ACTIONS: SignedInAction[] = [
  { name: 'searchWebRecipes', run: () => searchActions.searchWebRecipes({ query: 'pad thai' }) },
  {
    name: 'parseRecipeFromUrl',
    run: () => searchActions.parseRecipeFromUrl('https://example.com/recipe'),
  },
];

describe.each(SIGNED_IN_ACTIONS)('$name (signed-in action)', (action) => {
  it('returns an auth error to a signed-out caller and does no paid work', async () => {
    signedOut();
    const result = await action.run();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Authentication required/);
    expectNoPaidWork();
  });

  it('returns an error and does no paid work when the auth check throws', async () => {
    mocks.sessionUserId.mockRejectedValue(new Error('auth unavailable'));
    const result = await action.run();
    expect(result.success).toBe(false);
    expectNoPaidWork();
  });

  it('runs for any signed-in user', async () => {
    signedIn(undefined);
    await action.run();
    expect(mocks.llmCreate).toHaveBeenCalledTimes(1);
  });
});

describe('estimateRecipePrice', () => {
  it('is removed: no caller exists, so it is not a client-callable action', async () => {
    vi.doMock('@/app/actions/semantic-search', () => ({ semanticSearchRecipes: vi.fn() }));
    const mealActions = await import('@/app/actions/meal-suggestions');
    expect('estimateRecipePrice' in mealActions).toBe(false);
  });
});

// Resolved at run time so this file still loads on a commit without the module.
const CORE_MODULE = '@/lib/recipe-crawl';
const loadCore = (): Promise<typeof import('@/lib/recipe-crawl')> =>
  import(/* @vite-ignore */ CORE_MODULE);

describe('internal crawl path (cron, scripts, CRON_SECRET-gated routes)', () => {
  it('crawlWeeklyRecipes runs with no session', async () => {
    signedOut();
    const core = await loadCore();
    const result = await core.crawlWeeklyRecipes(0, { maxResults: 1 });
    expect(result.success).toBe(true);
    expect(mocks.discoverWeeklyRecipes).toHaveBeenCalledTimes(1);
  });

  it('convertUrlToRecipe runs with no session', async () => {
    signedOut();
    const core = await loadCore();
    await core.convertUrlToRecipe('https://example.com/recipe');
    expect(mocks.scrapeRecipePage).toHaveBeenCalledTimes(1);
  });
});
