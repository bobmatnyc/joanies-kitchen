// @vitest-environment node
/**
 * #44: createCollection inserts its row, and every duplicate path answers with
 * its friendly message.
 *
 * Why: createCollection parsed insertCollectionSchema with camelCase keys (every
 * create failed validation), and the duplicate checks matched the text 'unique',
 * which drizzle's wrapped error never carries. SQLSTATE 23505 is on error.cause.
 * What: runs the real actions against real Postgres (PGlite) with constraints.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const COLLECTION = '11111111-0000-4000-8000-000000000001';
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  auth: undefined as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock('@/lib/auth', () => {
  state.auth = vi.fn();
  return { auth: (...args: unknown[]) => state.auth(...args) };
});
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

// createCollection and addFavorite call ensureUserProfile; createOrUpdateProfile
// (same module) must stay real, so keep it and stub only ensureUserProfile.
vi.mock('@/app/actions/user-profiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/actions/user-profiles')>();
  return { ...actual, ensureUserProfile: vi.fn(async () => ({ username: 'owner' })) };
});

import { addRecipeToCollection, createCollection } from '@/app/actions/collections';
import { addFavorite } from '@/app/actions/favorites';
import { createOrUpdateProfile } from '@/app/actions/user-profiles';
import * as schema from '@/lib/db/schema';
import * as discovery from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;
const db = () => state.db as any;

beforeAll(async () => {
  const created = await createVisibilityDb(
    [
      schema.recipes,
      discovery.collections,
      discovery.collectionRecipes,
      discovery.favorites,
      discovery.userProfiles,
    ],
    { ...schema, ...discovery },
    { constraints: true }
  );
  client = created.client;
  state.db = created.db;
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  for (const t of ['collection_recipes', 'favorites', 'collections', 'user_profiles', 'recipes']) {
    await client.exec(`DELETE FROM "${t}";`);
  }
  await db().insert(schema.recipes).values({
    id: RECIPE,
    user_id: OTHER,
    name: 'Public recipe',
    ingredients: '["1 cup water"]',
    instructions: '[]',
    is_public: true,
  });
  state.auth.mockResolvedValue({ userId: OWNER, sessionClaims: { metadata: {} } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('createCollection (#44)', () => {
  it('inserts the collection and returns success', async () => {
    const result = await createCollection({ name: 'Weeknight Dinners', isPublic: true });

    expect(result.success).toBe(true);
    const rows = await db().select().from(discovery.collections);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: OWNER,
      name: 'Weeknight Dinners',
      slug: 'weeknight-dinners',
      is_public: true,
    });
  });

  it('answers a duplicate name with the friendly message and no second row', async () => {
    await createCollection({ name: 'Soups' });
    const again = await createCollection({ name: 'Soups' });

    expect(again).toEqual({
      success: false,
      error: 'You already have a collection with this name',
    });
    expect(await db().select().from(discovery.collections)).toHaveLength(1);
  });
});

describe('duplicate paths (#44)', () => {
  it('addFavorite: duplicate answers "Recipe already in favorites"', async () => {
    expect((await addFavorite(RECIPE)).success).toBe(true);
    const again = await addFavorite(RECIPE);

    expect(again).toEqual({ success: false, error: 'Recipe already in favorites' });
    expect(await db().select().from(discovery.favorites)).toHaveLength(1);
  });

  it('createOrUpdateProfile: a taken username answers "Username already taken"', async () => {
    const profile = { username: 'chef_taken', display_name: 'Chef' };
    expect((await createOrUpdateProfile(profile)).success).toBe(true);
    state.auth.mockResolvedValue({ userId: OTHER, sessionClaims: { metadata: {} } });
    const clash = await createOrUpdateProfile(profile);

    expect(clash).toEqual({ success: false, error: 'Username already taken' });
  });

  it('addRecipeToCollection: duplicate answers "Recipe already in this collection"', async () => {
    await db()
      .insert(discovery.collections)
      .values({ id: COLLECTION, user_id: OWNER, name: 'Mine', slug: 'mine' });
    expect((await addRecipeToCollection(COLLECTION, RECIPE)).success).toBe(true);
    const again = await addRecipeToCollection(COLLECTION, RECIPE);

    expect(again).toEqual({ success: false, error: 'Recipe already in this collection' });
  });
});
