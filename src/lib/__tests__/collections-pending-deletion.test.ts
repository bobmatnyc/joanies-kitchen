// @vitest-environment node
/**
 * #213: while an owner's account deletion is pending, their public collections,
 * and the profile data shown with them, appear in no public listing or lookup.
 * The filter is read-time only: collections keep `is_public`, the owner still
 * sees their own, and `restoreAccount` brings everything back unchanged.
 * Real server actions, service and v1 routes against PGlite.
 */

import type { PGlite } from '@electric-sql/pglite';
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
import {
  getCollectionById,
  getCollectionBySlug,
  getPublicCollections,
  getUserCollections,
} from '@/app/actions/collections';
import { GET as collectionRecipesGET } from '@/app/api/v1/collections/[id]/recipes/route';
import { GET as collectionGET } from '@/app/api/v1/collections/[id]/route';
import { markAccountDeleted, restoreAccount } from '@/lib/account-deletion';
import type { RouteContext } from '@/lib/api-auth/types';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { collectionRecipes, collections, userProfiles } from '@/lib/db/user-discovery-schema';
import { collectionService } from '@/lib/services/collection-service';

const PENDING = 'user_pending';
const NORMAL = 'user_normal';
const LEGACY = 'user_legacy_no_users_row';
const VIEWER = 'user_viewer';
const OWNERS = [PENDING, NORMAL, LEGACY];
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const REQUESTED_AT = new Date('2026-10-01T00:00:00.000Z');
const collectionIdOf = (owner: string) =>
  `11111111-0000-4000-8000-00000000000${OWNERS.indexOf(owner)}`;

let client: PGlite;

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

/** Collection rows as stored, to prove the filter wrote nothing. */
async function collectionRows() {
  return rows('SELECT id, user_id, is_public, updated_at FROM collections ORDER BY id');
}

async function apiGet(
  handler: typeof collectionGET,
  path: string,
  id: string
): Promise<{ status: number; body: any }> {
  const res = await handler(new NextRequest(`http://localhost${path}`), {
    params: Promise.resolve({ id }),
  } as RouteContext);
  return { status: res.status, body: await res.json() };
}

/**
 * One entry per public read path changed by #213. `sees(owner)` answers whether
 * the signed-in caller (state.userId) got the owner's public collection.
 */
const PATHS: Array<{ name: string; sees: (owner: string) => Promise<boolean> }> = [
  {
    name: 'getPublicCollections (/collections browse)',
    sees: async (owner) =>
      (await getPublicCollections()).some(
        (c) => c.user_id === owner && c.ownerUsername === `${owner}-name`
      ),
  },
  {
    name: 'getUserCollections(owner) (/profile/[username] collections)',
    sees: async (owner) => (await getUserCollections(owner)).some((c) => c.user_id === owner),
  },
  {
    name: 'getCollectionById',
    sees: async (owner) =>
      (await getCollectionById(collectionIdOf(owner)))?.recipes.some((r) => r.id === RECIPE) ===
      true,
  },
  {
    name: 'getCollectionBySlug (/collections/[username]/[slug])',
    sees: async (owner) => (await getCollectionBySlug(`${owner}-name`, 'mine')) !== null,
  },
  {
    name: 'collectionService.findPublic',
    sees: async (owner) => (await collectionService.findPublic()).some((c) => c.user_id === owner),
  },
  {
    name: 'GET /api/v1/collections/:id',
    sees: async (owner) => {
      const id = collectionIdOf(owner);
      const r = await apiGet(collectionGET, `/api/v1/collections/${id}`, id);
      return r.status === 200 && r.body.data?.user_id === owner;
    },
  },
  {
    name: 'GET /api/v1/collections/:id/recipes',
    sees: async (owner) => {
      const id = collectionIdOf(owner);
      const r = await apiGet(collectionRecipesGET, `/api/v1/collections/${id}/recipes`, id);
      return r.status === 200 && r.body.data?.items?.some((x: any) => x.id === RECIPE) === true;
    },
  },
];

// The v1 routes need a signed-in caller; the actions and service also run anonymously.
const API = new Set(['GET /api/v1/collections/:id', 'GET /api/v1/collections/:id/recipes']);
// findPublic takes no viewer: it is a public listing for every caller, the owner included.
const NO_VIEWER = new Set(['collectionService.findPublic']);

beforeAll(async () => {
  const built = await createVisibilityDb(
    [users, schema.recipes, userProfiles, collections, collectionRecipes],
    { ...schema, userProfiles, collections, collectionRecipes },
    { constraints: true }
  );
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await client.exec(
    'DELETE FROM collection_recipes; DELETE FROM collections; DELETE FROM user_profiles; DELETE FROM recipes; DELETE FROM users;'
  );
  // LEGACY has no users row (pre-Auth.js id).
  await rows(
    `INSERT INTO users (id, name, email) VALUES
      ($1, 'Pending', 'p@example.test'), ($2, 'Normal', 'n@example.test'), ($3, 'Viewer', 'v@example.test')`,
    [PENDING, NORMAL, VIEWER]
  );
  await client.exec(`INSERT INTO recipes (id, user_id, name, ingredients, instructions,
      is_public, moderation_status) VALUES
    ('${RECIPE}', '${VIEWER}', 'Soup', '[]', '[]', true, 'approved')`);
  for (const owner of OWNERS) {
    await rows(
      `INSERT INTO user_profiles (user_id, username, display_name, is_public)
        VALUES ($1, $2, $2, true)`,
      [owner, `${owner}-name`]
    );
    await rows(
      `INSERT INTO collections (id, user_id, name, slug, is_public, recipe_count)
        VALUES ($1, $2, 'Mine', 'mine', true, 1)`,
      [collectionIdOf(owner), owner]
    );
    await rows(
      'INSERT INTO collection_recipes (collection_id, recipe_id, position) VALUES ($1, $2, 0)',
      [collectionIdOf(owner), RECIPE]
    );
  }
  await markAccountDeleted(PENDING, true, REQUESTED_AT);
});

afterEach(() => {
  vi.restoreAllMocks();
  state.userId = null;
});

describe.each(PATHS)('#213 $name', (path) => {
  const viewers = API.has(path.name) ? [VIEWER] : [null, VIEWER];

  it.each(viewers)(
    'viewer %s: pending owner absent; normal and legacy owners present',
    async (v) => {
      state.userId = v;

      expect(await path.sees(PENDING)).toBe(false);
      expect(await path.sees(NORMAL)).toBe(true);
      expect(await path.sees(LEGACY)).toBe(true);
    }
  );

  it('the pending owner still sees their own collection', async () => {
    state.userId = PENDING;

    expect(await path.sees(PENDING)).toBe(!NO_VIEWER.has(path.name));
  });

  it('after restoreAccount the collection is listed again, with no collection row changed', async () => {
    const before = await collectionRows();
    state.userId = VIEWER;
    expect(await path.sees(PENDING)).toBe(false);

    await restoreAccount(PENDING, REQUESTED_AT);

    expect(await path.sees(PENDING)).toBe(true);
    expect(await collectionRows()).toEqual(before);
  });
});

describe('#213 the owner-only views are unchanged', () => {
  it("getUserCollections() lists the pending owner's own collections", async () => {
    state.userId = PENDING;

    expect((await getUserCollections()).map((c) => c.id)).toEqual([collectionIdOf(PENDING)]);
  });
});
