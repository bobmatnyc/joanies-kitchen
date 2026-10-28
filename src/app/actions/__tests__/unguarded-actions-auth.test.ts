/**
 * #13 follow-up: server actions that reach a paid API or write site-wide data
 * reject the wrong caller class before any database query or paid call.
 * A server action is callable by anyone over POST, so the guard lives in the
 * action. Removing any one guard turns that action's deny cases red: the
 * action then reaches the capturing db or a paid mock.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  queries: [] as string[],
  scrapeRecipePage: vi.fn(),
  crawlChefRecipes: vi.fn(),
  parseRecipeForIngestion: vi.fn(),
  classifyRecipeInstructions: vi.fn(),
  generateMealRecommendations: vi.fn(),
  parseRecipeWithAI: vi.fn(),
  blobDel: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
// #22: admin is read from users.is_admin; here the DB row mirrors the fixture's flag.
vi.mock('@/lib/auth-users', () => ({
  getUserAdminFlag: async () => (await mocks.auth())?.sessionClaims?.metadata?.isAdmin === 'true',
}));
vi.mock('@/lib/db', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  const schema = await import('@/lib/db/schema');
  const chefSchema = await import('@/lib/db/chef-schema');
  return {
    db: drizzle(
      async (sql) => {
        mocks.queries.push(sql);
        return { rows: [] };
      },
      { schema: { ...schema, ...chefSchema } }
    ),
  };
});
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/cache', () => ({ invalidateRecipeCaches: vi.fn() }));
vi.mock('@vercel/blob', () => ({ del: mocks.blobDel }));
vi.mock('@/lib/firecrawl', () => ({
  scrapeRecipePage: mocks.scrapeRecipePage,
  crawlChefRecipes: mocks.crawlChefRecipes,
}));
vi.mock('@/lib/ai/recipe-ingestion-parser', () => ({
  parseRecipeForIngestion: mocks.parseRecipeForIngestion,
  serializeIngredients: JSON.stringify,
  serializeInstructions: JSON.stringify,
  serializeTags: JSON.stringify,
}));
vi.mock('@/lib/ai/instruction-classifier', () => ({
  classifyRecipeInstructions: mocks.classifyRecipeInstructions,
}));
vi.mock('@/lib/ai/meal-recommendations', () => ({
  generateMealRecommendations: mocks.generateMealRecommendations,
}));
vi.mock('@/lib/ai/recipe-parser', () => ({ parseRecipeWithAI: mocks.parseRecipeWithAI }));

import * as chefScraping from '@/app/actions/chef-scraping';
import * as chefActions from '@/app/actions/chefs';
import * as classify from '@/app/actions/classify-instructions';
import * as hero from '@/app/actions/hero-backgrounds';
import * as joanie from '@/app/actions/joanie-comments';
import * as meals from '@/app/actions/meals';
import * as ingestion from '@/app/actions/recipe-ingestion';
import * as slideshow from '@/app/actions/slideshow';

const ID = '11111111-1111-4111-8111-111111111111';
const URL_ = 'https://example.com/recipe';

const PAID = [
  mocks.scrapeRecipePage,
  mocks.crawlChefRecipes,
  mocks.parseRecipeForIngestion,
  mocks.classifyRecipeInstructions,
  mocks.generateMealRecommendations,
  mocks.parseRecipeWithAI,
  mocks.blobDel,
];

type Outcome = { thrown?: string; error?: string };

async function outcome(run: () => Promise<unknown>): Promise<Outcome> {
  try {
    const result = (await run()) as { error?: string } | undefined;
    return { error: result?.error };
  } catch (error) {
    return { thrown: error instanceof Error ? error.message : String(error) };
  }
}

function expectNoWork() {
  expect(mocks.queries).toHaveLength(0);
  for (const paid of PAID) expect(paid).not.toHaveBeenCalled();
}

function didWork() {
  return mocks.queries.length > 0 || PAID.some((paid) => paid.mock.calls.length > 0);
}

function signedOut() {
  mocks.auth.mockResolvedValue({ userId: null, sessionClaims: null });
}

function signedIn(isAdmin: 'true' | 'false') {
  mocks.auth.mockResolvedValue({ userId: 'user_1', sessionClaims: { metadata: { isAdmin } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queries = [];
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  mocks.scrapeRecipePage.mockResolvedValue({ success: true, markdown: '# Soup', metadata: {} });
  mocks.parseRecipeForIngestion.mockResolvedValue({ name: 'Soup' });
  mocks.classifyRecipeInstructions.mockResolvedValue([]);
  mocks.generateMealRecommendations.mockResolvedValue({});
});

interface GuardedAction {
  name: string;
  run: () => Promise<unknown>;
  admitted?: (o: Outcome) => boolean;
}

const ADMIN_ACTIONS: GuardedAction[] = [
  { name: 'fetchRecipeFromUrl', run: () => ingestion.fetchRecipeFromUrl(URL_) },
  { name: 'ingestRecipeFromUrl', run: () => ingestion.ingestRecipeFromUrl(URL_) },
  { name: 'parseRecipeContent', run: () => ingestion.parseRecipeContent('# Soup', URL_) },
  {
    name: 'createComment',
    run: () => joanie.createComment({ recipe_id: ID, comment_text: 'Add salt' } as never),
  },
  { name: 'updateComment', run: () => joanie.updateComment(ID, 'Add pepper') },
  { name: 'deleteComment', run: () => joanie.deleteComment(ID) },
  { name: 'getAllBackgrounds', run: () => hero.getAllBackgrounds() },
  { name: 'createBackground', run: () => hero.createBackground('https://example.com/a.jpg') },
  { name: 'updateBackground', run: () => hero.updateBackground(ID, { is_active: false }) },
  { name: 'deleteBackground', run: () => hero.deleteBackground(ID) },
  { name: 'reorderBackground', run: () => hero.reorderBackground(ID, 'up') },
  {
    name: 'createPhoto',
    run: () => slideshow.createPhoto({ image_url: 'https://example.com/a.jpg' } as never),
  },
  { name: 'updatePhoto', run: () => slideshow.updatePhoto(ID, { is_active: false }) },
  { name: 'deletePhoto', run: () => slideshow.deletePhoto(ID) },
  { name: 'getAllPhotosAdmin', run: () => slideshow.getAllPhotosAdmin() },
  {
    name: 'reorderPhotos',
    run: () => slideshow.reorderPhotos([ID]),
    // The proxy db (like prod's neon-http driver) rejects db.transaction, so
    // reaching that error proves the admin got past the guard.
    admitted: (o) => /Transactions are not supported/.test(o.thrown ?? ''),
  },
  { name: 'getScrapingJobStatus', run: () => chefScraping.getScrapingJobStatus(ID) },
  { name: 'updateChefRecipeCount', run: () => chefActions.updateChefRecipeCount(ID) },
  { name: 'classifyRecipe', run: () => classify.classifyRecipe(ID) },
];

function expectAdminDenied(result: Outcome) {
  expect(result.thrown ?? result.error).toBe('Admin access required');
}

describe.each(ADMIN_ACTIONS)('$name (admin-only action)', (action) => {
  it('denies an anonymous caller before any query or paid call', async () => {
    signedOut();
    expectAdminDenied(await outcome(action.run));
    expectNoWork();
  });

  it('denies a signed-in non-admin before any query or paid call', async () => {
    signedIn('false');
    expectAdminDenied(await outcome(action.run));
    expectNoWork();
  });

  it('runs for an admin', async () => {
    signedIn('true');
    const result = await outcome(action.run);
    expect(result.thrown ?? result.error).not.toBe('Admin access required');
    expect(didWork() || action.admitted?.(result) === true).toBe(true);
  });
});

describe('recipe ingestion paid path (#13)', () => {
  it('fetchRecipeFromUrl denies before Firecrawl when the auth check throws', async () => {
    mocks.auth.mockRejectedValue(new Error('auth unavailable'));
    expectAdminDenied(await outcome(() => ingestion.fetchRecipeFromUrl(URL_)));
    expectNoWork();
  });

  it('ingestRecipeFromUrl calls Firecrawl and the LLM parser once for an admin', async () => {
    signedIn('true');
    const result = await ingestion.ingestRecipeFromUrl(URL_);
    expect(result.success).toBe(true);
    expect(mocks.scrapeRecipePage).toHaveBeenCalledTimes(1);
    expect(mocks.parseRecipeForIngestion).toHaveBeenCalledTimes(1);
  });
});

describe('getRecipeRecommendations (signed-in action)', () => {
  const run = () => meals.getRecipeRecommendations(ID);

  it('denies an anonymous caller before any query or paid call', async () => {
    signedOut();
    expect((await outcome(run)).error).toBe('Authentication required');
    expectNoWork();
  });

  it('runs for any signed-in user', async () => {
    signedIn('false');
    const result = await outcome(run);
    expect(result.error).not.toBe('Authentication required');
    expect(mocks.queries.length).toBeGreaterThan(0);
  });
});
