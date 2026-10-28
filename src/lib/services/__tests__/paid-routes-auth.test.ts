/**
 * #11, #13: routes that start paid work run only for an admin session or the
 * CRON_SECRET bearer; every other caller is rejected before any provider
 * call, DB write or outbound fetch.
 */

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  crawlWeeklyRecipes: vi.fn(),
  convertUrlToRecipe: vi.fn(),
  dbWrite: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
// #22: admin is read from users.is_admin; here the DB row mirrors the fixture's flag.
vi.mock('@/lib/auth-users', () => ({
  getUserAdminFlag: async () => (await mocks.auth())?.sessionClaims?.metadata?.isAdmin === 'true',
}));
vi.mock('@/lib/recipe-crawl', () => ({
  crawlWeeklyRecipes: mocks.crawlWeeklyRecipes,
  convertUrlToRecipe: mocks.convertUrlToRecipe,
}));
vi.mock('@/lib/db', () => ({
  db: { insert: mocks.dbWrite, update: mocks.dbWrite, delete: mocks.dbWrite },
}));
// #13: crawl/weekly used to trust this Host header; every request here spoofs localhost.
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'localhost:3000' }),
}));

import { POST as batchImportSinglePost } from '@/app/api/batch-import-single/route';
import { POST as batchImportSmallPost } from '@/app/api/batch-import-small/route';
import { POST as crawlWeeklyPost } from '@/app/api/crawl/weekly/route';
import { POST as scrapePost } from '@/app/api/recipes/scrape/route';

type Handler = (req: never) => Promise<Response>;

interface PaidRoute {
  name: string;
  handler: Handler;
  url: string;
  body: unknown;
  paidWork: Mock;
}

const ROUTES: PaidRoute[] = [
  {
    name: 'POST /api/recipes/scrape',
    handler: scrapePost as Handler,
    url: 'http://localhost/api/recipes/scrape',
    body: { weeksAgo: 0, maxResults: 2 },
    paidWork: mocks.crawlWeeklyRecipes,
  },
  {
    name: 'POST /api/batch-import-small',
    handler: batchImportSmallPost as Handler,
    url: 'http://localhost/api/batch-import-small',
    body: { urls: ['https://example.com/recipe'], chefName: 'Test Chef' },
    paidWork: mocks.convertUrlToRecipe,
  },
  {
    name: 'POST /api/batch-import-single',
    handler: batchImportSinglePost as Handler,
    url: 'http://localhost/api/batch-import-single',
    body: { url: 'https://example.com/recipe', chefName: 'Test Chef' },
    paidWork: mocks.convertUrlToRecipe,
  },
  {
    name: 'POST /api/crawl/weekly',
    handler: crawlWeeklyPost as Handler,
    url: 'http://localhost/api/crawl/weekly',
    body: { weeksAgo: 0, maxResults: 5 },
    paidWork: mocks.crawlWeeklyRecipes,
  },
];

const SECRET = 'test-secret';
const fetchSpy = vi.fn();

function signedOut() {
  mocks.auth.mockResolvedValue({ userId: null, sessionClaims: null });
}

function signedIn(isAdmin: string | undefined) {
  mocks.auth.mockResolvedValue({ userId: 'user_1', sessionClaims: { metadata: { isAdmin } } });
}

function call(route: PaidRoute, headers: Record<string, string> = {}) {
  const req = new Request(route.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'localhost', ...headers },
    body: JSON.stringify(route.body),
  });
  return route.handler(req as never);
}

function expectNoWork() {
  expect(mocks.crawlWeeklyRecipes).not.toHaveBeenCalled();
  expect(mocks.convertUrlToRecipe).not.toHaveBeenCalled();
  expect(mocks.dbWrite).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
}

async function expectRejected(res: Response, status: number) {
  expect(res.status).toBe(status);
  expect(await res.json()).toMatchObject({ error: expect.any(String) });
  expectNoWork();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', fetchSpy);
  vi.stubEnv('CRON_SECRET', SECRET);
  mocks.crawlWeeklyRecipes.mockResolvedValue({ success: true, recipes: [], stats: {} });
  mocks.convertUrlToRecipe.mockResolvedValue({ success: true, recipe: { name: 'Soup' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each(ROUTES)('$name auth', (route) => {
  it('rejects an unauthenticated caller with 401 and does no paid work', async () => {
    signedOut();
    await expectRejected(await call(route), 401);
  });

  it('rejects a signed-in non-admin with 403 and does no paid work', async () => {
    signedIn('false');
    await expectRejected(await call(route), 403);
  });

  it('rejects a wrong bearer with 401 and does no paid work', async () => {
    signedOut();
    await expectRejected(await call(route, { authorization: 'Bearer wrong-secret' }), 401);
  });

  it('rejects the bearer path when CRON_SECRET is unset', async () => {
    vi.stubEnv('CRON_SECRET', undefined);
    expect('CRON_SECRET' in process.env).toBe(false);
    signedOut();
    for (const header of ['Bearer undefined', 'Bearer ']) {
      await expectRejected(await call(route, { authorization: header }), 401);
    }
  });

  it('rejects with 401 and does no paid work when the auth check throws', async () => {
    mocks.auth.mockRejectedValue(new Error('auth unavailable'));
    await expectRejected(await call(route), 401);
  });

  it('runs for a signed-in admin', async () => {
    signedIn('true');
    const res = await call(route);
    expect(res.status).toBe(200);
    expect(route.paidWork).toHaveBeenCalledTimes(1);
  });

  it('runs for the correct CRON_SECRET bearer', async () => {
    signedOut();
    const res = await call(route, { authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect(route.paidWork).toHaveBeenCalledTimes(1);
  });
});
