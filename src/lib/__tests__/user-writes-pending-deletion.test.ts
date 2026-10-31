// @vitest-environment node
/**
 * #208: comments, forks, collections (create and add-recipe) and reports are
 * refused for an account whose deletion is pending (`users.deletion_requested_at`
 * set). The check rides in each write statement (`insertUnlessPendingDeletion`),
 * so a refused write leaves no row and changes no counter, and a deletion
 * requested after every earlier read still refuses. Ids with no `users` row and
 * accounts with no pending deletion write as before.
 * Real server actions, services and v1 routes against PGlite tables carrying
 * the production foreign keys.
 */

import type { PGlite } from '@electric-sql/pglite';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown, userId: null as string | null }));

vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => state.userId,
  getSessionUser: async () => (state.userId ? { id: state.userId } : null),
}));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: async () => ({ allowed: true, count: 1, limit: 20 }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
// No apiKeyId, so the wrappers skip api_key_usage tracking.
vi.mock('@/lib/api-auth/middleware', () => ({
  authenticateRequest: async () =>
    state.userId
      ? { authenticated: true, userId: state.userId, authType: 'api_key', scopes: ['*'] }
      : { authenticated: false, error: 'Authentication required' },
  authHasAllScopes: () => true,
  authHasAnyScope: () => true,
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { addRecipeToCollection, createCollection } from '@/app/actions/collections';
import { flagRecipe } from '@/app/actions/flag-recipe';
import { reportComment } from '@/app/actions/report-comment';
import { addRecipeComment, forkRecipe } from '@/app/actions/social';
import { POST as collectionRecipesPOST } from '@/app/api/v1/collections/[id]/recipes/route';
import { POST as collectionsPOST } from '@/app/api/v1/collections/route';
import {
  AccountPendingDeletionError,
  pendingDeletionError,
} from '@/lib/account-deletion/guarded-insert';
import type { RouteContext } from '@/lib/api-auth/types';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { collectionRecipes, collections, userProfiles } from '@/lib/db/user-discovery-schema';
import { collectionService } from '@/lib/services/collection-service';
import { socialService } from '@/lib/services/social-service';

const PENDING = 'user_pending';
const NORMAL = 'user_normal';
const LEGACY = 'user_legacy_no_users_row';
const AUTHOR = 'user_comment_author';
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const COMMENT = 'cccccccc-0000-4000-8000-00000000000c';
const COLLECTION: Record<string, string> = {
  [PENDING]: '11111111-0000-4000-8000-000000000001',
  [NORMAL]: '11111111-0000-4000-8000-000000000002',
  [LEGACY]: '11111111-0000-4000-8000-000000000003',
};

let client: PGlite;
type ExecDb = { execute: (q: SQL) => Promise<unknown> };

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

/** Every content row and counter a guarded path could write. */
async function snapshot() {
  return {
    comments: await rows('SELECT id, user_id, content FROM recipe_comments ORDER BY id'),
    forks: await rows('SELECT recipe_id, original_recipe_id, user_id FROM recipe_forks'),
    recipes: await rows(
      'SELECT id, user_id, fork_count, collection_count, like_count FROM recipes ORDER BY id'
    ),
    collections: await rows('SELECT id, user_id, name, recipe_count FROM collections ORDER BY id'),
    collectionRecipes: await rows(
      'SELECT collection_id, recipe_id, position FROM collection_recipes ORDER BY collection_id'
    ),
    flags: await rows('SELECT recipe_id, comment_id, user_id FROM recipe_flags ORDER BY user_id'),
  };
}

const sqlOf = (q: SQL) => new PgDialect().sqlToQuery(q).sql;
const insertsInto = (q: SQL, table: string) => sqlOf(q).includes(`INSERT INTO "${table}"`);

type Outcome = { ok: true } | { refused: string };

/** Runs a service call: success, or the typed refusal. Any other error fails the test. */
async function service(call: () => Promise<unknown>): Promise<Outcome> {
  try {
    await call();
    return { ok: true };
  } catch (error) {
    if (error instanceof AccountPendingDeletionError) return { refused: error.message };
    throw error;
  }
}

/** Runs a server action: success, or its `{ success: false, error }`. */
async function action(call: () => Promise<{ success: boolean; error?: string }>): Promise<Outcome> {
  const result = await call();
  return result.success ? { ok: true } : { refused: result.error ?? '' };
}

/**
 * One entry per guarded write path. `table` is the table its guarded INSERT
 * targets; `action` names the refused action in the refusal text.
 */
const PATHS: Array<{
  name: string;
  table: string;
  action: string;
  run: (userId: string) => Promise<Outcome>;
}> = [
  {
    name: 'addRecipeComment (server action)',
    table: 'recipe_comments',
    action: 'comment on recipes',
    run: () => action(() => addRecipeComment(RECIPE, 'Lovely')),
  },
  {
    name: 'socialService.addComment',
    table: 'recipe_comments',
    action: 'comment on recipes',
    run: (u) => service(() => socialService.addComment(u, RECIPE, 'Lovely')),
  },
  {
    name: 'forkRecipe (server action)',
    table: 'recipes',
    action: 'fork recipes',
    run: () => action(() => forkRecipe(RECIPE)),
  },
  {
    name: 'socialService.forkRecipe',
    table: 'recipes',
    action: 'fork recipes',
    run: (u) => service(() => socialService.forkRecipe(u, RECIPE)),
  },
  {
    name: 'createCollection (server action)',
    table: 'collections',
    action: 'create collections',
    run: () => action(() => createCollection({ name: 'Soups' })),
  },
  {
    name: 'collectionService.create',
    table: 'collections',
    action: 'create collections',
    run: (u) => service(() => collectionService.create(u, { name: 'Soups' })),
  },
  {
    name: 'addRecipeToCollection (server action)',
    table: 'collection_recipes',
    action: 'add recipes to collections',
    run: (u) => action(() => addRecipeToCollection(COLLECTION[u], RECIPE)),
  },
  {
    name: 'collectionService.addRecipe',
    table: 'collection_recipes',
    action: 'add recipes to collections',
    run: (u) => service(() => collectionService.addRecipe(u, COLLECTION[u], RECIPE)),
  },
  {
    name: 'flagRecipe (server action)',
    table: 'recipe_flags',
    action: 'report recipes',
    run: () => action(() => flagRecipe(RECIPE, 'spam')),
  },
  {
    name: 'reportComment (server action)',
    table: 'recipe_flags',
    action: 'report comments',
    run: () => action(() => reportComment(COMMENT, 'spam')),
  },
];

beforeAll(async () => {
  const built = await createVisibilityDb(
    [
      users,
      schema.recipes,
      userProfiles,
      schema.recipeComments,
      schema.recipeForks,
      schema.recipeFlags,
      collections,
      collectionRecipes,
    ],
    { ...schema, userProfiles, collections, collectionRecipes },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
  // The production foreign keys (schema.ts, user-discovery-schema.ts) and the
  // 0004 partial unique index; the helper builds columns and defaults only.
  await client.exec(`
    ALTER TABLE "recipe_comments" ADD FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE;
    ALTER TABLE "recipe_forks" ADD FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE;
    ALTER TABLE "recipe_forks" ADD FOREIGN KEY ("original_recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE;
    ALTER TABLE "recipe_flags" ADD FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE;
    ALTER TABLE "collections" ADD FOREIGN KEY ("user_id") REFERENCES "user_profiles" ("user_id") ON DELETE CASCADE;
    ALTER TABLE "collection_recipes" ADD FOREIGN KEY ("collection_id") REFERENCES "collections" ("id") ON DELETE CASCADE;
    ALTER TABLE "collection_recipes" ADD FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE;
    CREATE UNIQUE INDEX "recipe_flags_comment_user_unique" ON "recipe_flags" ("comment_id","user_id") WHERE "comment_id" IS NOT NULL;`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  await client.exec(`DELETE FROM "recipe_flags"; DELETE FROM "recipe_forks";
    DELETE FROM "recipe_comments"; DELETE FROM "collection_recipes"; DELETE FROM "collections";
    DELETE FROM "user_profiles"; DELETE FROM "recipes"; DELETE FROM "users";`);
  await rows(
    `INSERT INTO users (id, email, deletion_requested_at) VALUES
      ($1, 'p@example.test', '2026-10-01T00:00:00Z'), ($2, 'n@example.test', NULL)`,
    [PENDING, NORMAL]
  );
  await client.exec(`INSERT INTO "user_profiles" (user_id, username, display_name, is_public) VALUES
    ('${PENDING}', 'pending', 'Pending', false), ('${NORMAL}', 'normal', 'Normal', true),
    ('${LEGACY}', 'legacy', 'Legacy', true)`);
  // Counters start non-zero, so any write to them shows.
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions,
      is_public, moderation_status, fork_count, collection_count, like_count) VALUES
    ('${RECIPE}', 'owner', 'Soup', '[]', '[]', true, 'approved', 2, 4, 6)`);
  await client.exec(`INSERT INTO "recipe_comments" (id, recipe_id, user_id, content) VALUES
    ('${COMMENT}', '${RECIPE}', '${AUTHOR}', 'Too salty')`);
  for (const [owner, id] of Object.entries(COLLECTION)) {
    await rows(
      `INSERT INTO collections (id, user_id, name, slug, recipe_count) VALUES ($1, $2, 'Mine', 'mine', 3)`,
      [id, owner]
    );
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  state.userId = null;
});

describe('#208 guarded writes refuse an account with a pending deletion', () => {
  it('words the refusal per path', () => {
    expect(pendingDeletionError('comment on recipes')).toBe(
      'Your account is scheduled for deletion, so you cannot comment on recipes. Cancel the deletion to comment on recipes again.'
    );
  });

  it.each(PATHS)('$name: refuses, writes no row and changes no counter', async (path) => {
    state.userId = PENDING;
    const before = await snapshot();

    expect(await path.run(PENDING)).toEqual({ refused: pendingDeletionError(path.action) });

    expect(await snapshot()).toEqual(before);
  });

  it.each(PATHS)(
    '$name: refuses when the deletion is requested after every read before the statement',
    async (path) => {
      // A guard in a separate query before the statement passes here and the write lands.
      const db = state.db as ExecDb;
      const original = db.execute.bind(db);
      vi.spyOn(db, 'execute').mockImplementation(async (q) => {
        if (insertsInto(q, path.table)) {
          await rows('UPDATE users SET deletion_requested_at = now() WHERE id = $1', [NORMAL]);
        }
        return original(q);
      });
      state.userId = NORMAL;
      const before = await snapshot();

      expect(await path.run(NORMAL)).toEqual({ refused: pendingDeletionError(path.action) });

      expect(await snapshot()).toEqual(before);
    }
  );

  it.each(PATHS)('$name: carries the guard in its write statement', async (path) => {
    const db = state.db as ExecDb;
    const execute = vi.spyOn(db, 'execute');
    state.userId = PENDING;

    await path.run(PENDING);

    const writes = execute.mock.calls.map(([q]) => q).filter((q) => insertsInto(q, path.table));
    expect(writes).toHaveLength(1);
    const text = sqlOf(writes[0]).replace(/\s+/g, ' ');
    expect(text).toMatch(
      new RegExp(
        `^ WITH allowed AS \\( SELECT 1 AS ok WHERE NOT EXISTS \\(SELECT 1 FROM "users" WHERE "users"\\."id" = \\$\\d+ AND "users"\\."deletion_requested_at" IS NOT NULL\\) \\), inserted AS \\( INSERT INTO "${path.table}" \\([^)]*\\) SELECT .* FROM allowed `
      )
    );
  });
});

describe('#208 guarded writes are unchanged for other accounts', () => {
  it.each(
    PATHS.flatMap((path) => [
      { ...path, who: 'a users row with no pending deletion', userId: NORMAL },
      { ...path, who: 'a legacy id with no users row', userId: LEGACY },
    ])
  )('$name, $who: writes one row', async (path) => {
    state.userId = path.userId;
    const count = async () => (await rows(`SELECT count(*)::int AS n FROM "${path.table}"`))[0].n;
    const before = await count();

    expect(await path.run(path.userId)).toEqual({ ok: true });

    expect(await count()).toBe(Number(before) + 1);
  });

  it('a fork writes the private copy and its link in one statement', async () => {
    state.userId = NORMAL;

    const result = await forkRecipe(RECIPE);

    expect(result).toMatchObject({
      success: true,
      data: { user_id: NORMAL, name: 'Soup (Forked)', is_public: false },
    });
    const forkId = (result as { data: { id: string; created_at: Date } }).data.id;
    expect((result as { data: { created_at: Date } }).data.created_at).toBeInstanceOf(Date);
    expect(await rows('SELECT recipe_id, original_recipe_id, user_id FROM recipe_forks')).toEqual([
      { recipe_id: forkId, original_recipe_id: RECIPE, user_id: NORMAL },
    ]);
  });

  it('an add bumps recipe_count and collection_count once', async () => {
    state.userId = NORMAL;

    expect(await addRecipeToCollection(COLLECTION[NORMAL], RECIPE)).toMatchObject({
      success: true,
    });

    expect(
      await rows('SELECT recipe_count FROM collections WHERE id = $1', [COLLECTION[NORMAL]])
    ).toEqual([{ recipe_count: 4 }]);
    expect(await rows('SELECT collection_count FROM recipes')).toEqual([{ collection_count: 5 }]);
  });

  it('a repeat comment report still answers alreadyReported', async () => {
    state.userId = NORMAL;
    expect(await reportComment(COMMENT, 'spam')).toEqual({ success: true, hidden: false });
    const before = await snapshot();

    expect(await reportComment(COMMENT, 'spam')).toEqual({ success: true, alreadyReported: true });

    expect(await snapshot()).toEqual(before);
  });
});

describe('#208 v1 API answers a pending-deletion write with 403', () => {
  const post = (path: string, body: unknown) =>
    new NextRequest(`http://localhost${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });

  it.each([
    [
      'POST /api/v1/collections',
      'create collections',
      () =>
        collectionsPOST(post('/api/v1/collections', { name: 'Soups' }), {
          params: Promise.resolve({}),
        } as RouteContext),
    ],
    [
      'POST /api/v1/collections/:id/recipes',
      'add recipes to collections',
      () =>
        collectionRecipesPOST(
          post(`/api/v1/collections/${COLLECTION[PENDING]}/recipes`, { recipeId: RECIPE }),
          { params: Promise.resolve({ id: COLLECTION[PENDING] }) } as RouteContext
        ),
    ],
  ])('%s', async (_n, verb, call) => {
    state.userId = PENDING;
    const before = await snapshot();

    const res = await call();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      success: false,
      error: pendingDeletionError(verb),
      reason: 'forbidden',
    });
    expect(await snapshot()).toEqual(before);
  });
});
