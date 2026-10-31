// @vitest-environment node
/**
 * #135: old URLs of recipes soft-deleted by the duplicate merge redirect (307, or 308
 * when RECIPE_REDIRECT_STATUS=308) to
 * the live survivor, through `recipe_redirects`.
 *
 * The layout, `generateMetadata` and the v1 API routes run against real Postgres
 * (PGlite). `recipe_redirects` is created from the merge's table contract DDL.
 * `permanentRedirect()` and `notFound()` are the real Next functions; the test
 * reads the digest each one throws.
 *
 * Every negative case is paired with a positive control in the same test, so each
 * test fails when the redirect lookup is removed.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const SURVIVOR = 'a0000000-0000-4000-8000-000000000001';
const SURVIVOR_NO_SLUG = 'a0000000-0000-4000-8000-000000000002';
const DEAD_SURVIVOR = 'a0000000-0000-4000-8000-000000000003';
const LOSER = 'b0000000-0000-4000-8000-000000000001';
const LOSER_TO_NO_SLUG = 'b0000000-0000-4000-8000-000000000002';
const LOSER_TO_DEAD = 'b0000000-0000-4000-8000-000000000003';
const LIVE = 'c0000000-0000-4000-8000-000000000001';
const LIVE_PRIVATE = 'c0000000-0000-4000-8000-000000000002';
const UNKNOWN = 'd0000000-0000-4000-8000-000000000001';
const NOT_FOUND_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;404';
const DELETED_AT = new Date('2026-10-01T00:00:00Z');

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  executeCalls: 0,
}));

vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => null,
  getSessionUser: async () => null,
}));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/db/embeddings', () => ({
  getRecipeEmbedding: vi.fn(async () => null),
  findSimilarRecipes: vi.fn(async () => []),
}));
vi.mock('@/lib/api-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-auth')>()),
  // The route handler runs as an authenticated caller; scopes are not under test.
  requireScopes:
    (_scopes: string[], handler: (...args: unknown[]) => unknown) =>
    (request: unknown, context: unknown) =>
      handler(request, { authenticated: true, userId: null, scopes: [] }, context),
}));

import { NextRequest } from 'next/server';
import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { GET as recipeApiGET } from '@/app/api/v1/recipes/[id]/route';
import { GET as similarApiGET } from '@/app/api/v1/recipes/[id]/similar/route';
import { metadata as notFoundMetadata } from '@/app/not-found';
import RecipeLayout, { generateMetadata } from '@/app/recipes/[slug]/layout';
import * as schema from '@/lib/db/schema';
import { findRecipeRedirect } from '@/lib/recipe-redirects';

let client: PGlite;

function row(
  id: string,
  slug: string | null,
  opts: { isPublic?: boolean; deleted?: boolean } = {}
) {
  return {
    id,
    slug,
    user_id: OWNER,
    name: `Recipe ${slug ?? id}`,
    description: 'desc',
    ingredients: '[]',
    instructions: '[]',
    is_public: opts.isPublic ?? true,
    is_system_recipe: false,
    fork_count: 0,
    like_count: 0,
    deleted_at: opts.deleted ? DELETED_AT : null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
}

type Outcome =
  | { kind: 'value'; value: unknown }
  | { kind: 'thrown'; digest: string | undefined; message: string };

async function outcome(fn: () => Promise<unknown>): Promise<Outcome> {
  try {
    return { kind: 'value', value: await fn() };
  } catch (error) {
    const e = error as { digest?: string; message?: string };
    return { kind: 'thrown', digest: e.digest, message: String(e.message) };
  }
}

async function visit(slug: string) {
  const params = Promise.resolve({ slug });
  return {
    metadata: await outcome(() => generateMetadata({ params })),
    layout: await outcome(() => RecipeLayout({ children: null, params })),
  };
}

/** The digest `redirect(path)` (307) or `permanentRedirect(path)` (308) throws. */
function redirectTo(path: string, status: 307 | 308 = 307) {
  const escaped = path.replace(/[/-]/g, '\\$&');
  return {
    kind: 'thrown',
    digest: expect.stringMatching(new RegExp(`^NEXT_REDIRECT;[a-z]+;${escaped};${status};`)),
  };
}

const NOT_FOUND = { kind: 'thrown', digest: NOT_FOUND_DIGEST };

function apiCall(handler: typeof recipeApiGET, path: string, id: string) {
  return handler(new NextRequest(`http://localhost${path}`), {
    params: Promise.resolve({ id }),
  });
}

beforeAll(async () => {
  const built = await createVisibilityDb([schema.recipes], schema);
  client = built.client;
  // Count raw-SQL queries; the redirect lookup is the only `db.execute` on these paths.
  const realExecute = built.db.execute.bind(built.db);
  state.db = Object.assign(built.db, {
    execute: ((query: Parameters<typeof realExecute>[0]) => {
      state.executeCalls += 1;
      return realExecute(query);
    }) as typeof realExecute,
  });

  // #135: the merge's table contract, verbatim in meaning.
  await client.exec(`
    ALTER TABLE recipes ADD PRIMARY KEY (id);
    CREATE TABLE recipe_redirects (
      from_recipe_id text PRIMARY KEY,
      from_slug text,
      to_recipe_id text NOT NULL REFERENCES recipes(id),
      batch_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX recipe_redirects_from_slug_key
      ON recipe_redirects (from_slug) WHERE from_slug IS NOT NULL;
  `);

  await built.db
    .insert(schema.recipes)
    .values([
      row(SURVIVOR, 'survivor-soup'),
      row(SURVIVOR_NO_SLUG, null),
      row(DEAD_SURVIVOR, 'dead-survivor', { deleted: true }),
      row(LOSER, 'loser-soup', { deleted: true }),
      row(LOSER_TO_NO_SLUG, 'loser-two', { deleted: true }),
      row(LOSER_TO_DEAD, 'loser-three', { deleted: true }),
      row(LIVE, 'live-soup'),
      row(LIVE_PRIVATE, 'live-private', { isPublic: false }),
    ]);

  await client.exec(`
    INSERT INTO recipe_redirects (from_recipe_id, from_slug, to_recipe_id, batch_id) VALUES
      ('${LOSER}', 'loser-soup', '${SURVIVOR}', 'b1'),
      ('${LOSER_TO_NO_SLUG}', 'loser-two', '${SURVIVOR_NO_SLUG}', 'b1'),
      ('${LOSER_TO_DEAD}', 'loser-three', '${DEAD_SURVIVOR}', 'b1'),
      -- Rows that must never fire: their source recipe is live (visible / hidden).
      ('${LIVE}', 'live-soup', '${SURVIVOR}', 'b1'),
      ('${LIVE_PRIVATE}', 'live-private', '${SURVIVOR}', 'b1');
  `);
});

beforeEach(() => {
  // #135: every test starts with the switch truly unset (the 307 default).
  vi.stubEnv('RECIPE_REDIRECT_STATUS', undefined);
  state.executeCalls = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await client?.close();
});

describe('/recipes/[slug] merged-recipe redirects (#135)', () => {
  it('an old id redirects to the survivor slug; metadata does not throw', async () => {
    const result = await visit(LOSER);

    expect(result.layout).toMatchObject(redirectTo('/recipes/survivor-soup'));
    expect(result.metadata).toEqual({ kind: 'value', value: notFoundMetadata });
  });

  it('an old slug redirects to the survivor slug', async () => {
    const result = await visit('loser-soup');

    expect(result.layout).toMatchObject(redirectTo('/recipes/survivor-soup'));
  });

  it('a survivor with no slug is reached by its id URL', async () => {
    for (const from of [LOSER_TO_NO_SLUG, 'loser-two']) {
      const result = await visit(from);
      expect(result.layout).toMatchObject(redirectTo(`/recipes/${SURVIVOR_NO_SLUG}`));
    }
  });

  it('a live recipe is not redirected and costs no lookup; its soft-deleted twin is', async () => {
    const live = await visit('live-soup');
    expect(live.layout.kind).toBe('value');
    expect(state.executeCalls).toBe(0);

    // A live recipe the viewer cannot see keeps today's 404, despite its redirect row.
    const hidden = await visit('live-private');
    expect(hidden.layout).toMatchObject(NOT_FOUND);

    // Control: once the same kind of recipe is soft-deleted, its row fires.
    await client.query('UPDATE recipes SET deleted_at = $1 WHERE id = $2', [DELETED_AT, LIVE]);
    try {
      const merged = await visit('live-soup');
      expect(merged.layout).toMatchObject(redirectTo('/recipes/survivor-soup'));
    } finally {
      await client.query('UPDATE recipes SET deleted_at = NULL WHERE id = $1', [LIVE]);
    }
  });

  it('a soft-deleted survivor gives no redirect (no chains); a live one does', async () => {
    const toDead = await visit(LOSER_TO_DEAD);
    expect(toDead.layout).toMatchObject(NOT_FOUND);
    expect(toDead.metadata).toEqual({ kind: 'value', value: notFoundMetadata });

    await client.query('UPDATE recipes SET deleted_at = NULL WHERE id = $1', [DEAD_SURVIVOR]);
    try {
      const toRevived = await visit(LOSER_TO_DEAD);
      expect(toRevived.layout).toMatchObject(redirectTo('/recipes/dead-survivor'));
    } finally {
      await client.query('UPDATE recipes SET deleted_at = $1 WHERE id = $2', [
        DELETED_AT,
        DEAD_SURVIVOR,
      ]);
    }
  });

  it('an unknown id keeps the 404 path after one lookup; a known old id redirects', async () => {
    const unknown = await visit(UNKNOWN);
    expect(unknown.layout).toMatchObject(NOT_FOUND);
    expect(unknown.metadata).toEqual({ kind: 'value', value: notFoundMetadata });
    expect(state.executeCalls).toBe(1);

    const known = await visit(LOSER);
    expect(known.layout).toMatchObject(redirectTo('/recipes/survivor-soup'));
  });
});

describe('/api/v1/recipes/[id] merged-recipe redirects (#135)', () => {
  it('GET on an old id or slug redirects to the survivor API URL; unknown stays 404', async () => {
    for (const from of [LOSER, 'loser-soup']) {
      const response = await apiCall(recipeApiGET, `/api/v1/recipes/${from}`, from);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(`http://localhost/api/v1/recipes/${SURVIVOR}`);
    }

    const unknown = await apiCall(recipeApiGET, `/api/v1/recipes/${UNKNOWN}`, UNKNOWN);
    expect(unknown.status).toBe(404);
  });

  it('GET similar on an old id redirects to the survivor similar URL, query kept', async () => {
    const response = await apiCall(
      similarApiGET,
      `/api/v1/recipes/${LOSER}/similar?limit=5`,
      LOSER
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      `http://localhost/api/v1/recipes/${SURVIVOR}/similar?limit=5`
    );
  });
});

// #135: the missing-table arm keeps today's 404 only for SQLSTATE 42P01; every other
// database error must still throw, so an outage is a 500, not a silent 404.
describe('findRecipeRedirect database errors (#135)', () => {
  /** Runs `fn` with `db.execute` replaced by one that rejects with `error`. */
  async function withExecuteError<T>(error: unknown, fn: () => Promise<T>): Promise<T> {
    const real = state.db;
    state.db = {
      execute: async () => {
        throw error;
      },
    };
    try {
      return await fn();
    } finally {
      state.db = real;
    }
  }

  it('a missing recipe_redirects table in Postgres gives null and a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await client.exec('ALTER TABLE recipe_redirects RENAME TO recipe_redirects_absent');
    try {
      await expect(findRecipeRedirect(LOSER)).resolves.toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('recipe_redirects'));
    } finally {
      await client.exec('ALTER TABLE recipe_redirects_absent RENAME TO recipe_redirects');
      warn.mockRestore();
    }
    // Control: with the table back, the same id resolves.
    await expect(findRecipeRedirect(LOSER)).resolves.toMatchObject({ id: SURVIVOR });
  });

  it.each([
    ['on the error', { code: '42P01' }],
    ['on drizzle-wrapped cause', { cause: { code: '42P01' } }],
  ])('undefined_table (42P01) %s gives null', async (_where, error) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await expect(withExecuteError(error, () => findRecipeRedirect(LOSER))).resolves.toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  it.each([
    ['query_canceled (57014)', { code: '57014' }],
    ['a plain Error', new Error('connection reset')],
    ['undefined_column (42703) on cause', { cause: { code: '42703' } }],
  ])('%s rethrows', async (_name, error) => {
    await expect(withExecuteError(error, () => findRecipeRedirect(LOSER))).rejects.toBe(error);
  });
});

// #135: RECIPE_REDIRECT_STATUS picks 307 (default) or 308 for the page and the API.
// Each test also checks the opposite setting, so hard-coding either status fails it.
describe('RECIPE_REDIRECT_STATUS switch (#135)', () => {
  async function statuses() {
    const page = await visit(LOSER);
    const api = await apiCall(recipeApiGET, `/api/v1/recipes/${LOSER}`, LOSER);
    const similar = await apiCall(similarApiGET, `/api/v1/recipes/${LOSER}/similar`, LOSER);
    return { page: page.layout, api: api.status, similar: similar.status };
  }

  function expectStatus(result: Awaited<ReturnType<typeof statuses>>, status: 307 | 308) {
    expect(result.page).toMatchObject(redirectTo('/recipes/survivor-soup', status));
    expect(result.api).toBe(status);
    expect(result.similar).toBe(status);
  }

  it('unset gives 307 on the page and the API', async () => {
    expectStatus(await statuses(), 307);

    vi.stubEnv('RECIPE_REDIRECT_STATUS', '308');
    expectStatus(await statuses(), 308);
  });

  it('308 gives 308 on the page and the API; 307 gives 307', async () => {
    vi.stubEnv('RECIPE_REDIRECT_STATUS', '308');
    expectStatus(await statuses(), 308);

    vi.stubEnv('RECIPE_REDIRECT_STATUS', '307');
    expectStatus(await statuses(), 307);
  });

  it.each(['301', '308x', 'permanent', ''])('invalid value %j gives 307', async (value) => {
    vi.stubEnv('RECIPE_REDIRECT_STATUS', value);
    expectStatus(await statuses(), 307);

    vi.stubEnv('RECIPE_REDIRECT_STATUS', '308');
    expectStatus(await statuses(), 308);
  });
});
