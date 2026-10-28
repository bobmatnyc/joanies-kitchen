// @vitest-environment node
/**
 * #43: addRecipeToCollection inserts the collection_recipes row.
 *
 * Why: the action parsed insertCollectionRecipeSchema with camelCase keys while
 * the schema expects snake_case, so every add failed validation.
 * What: runs the real action against real Postgres (PGlite) with constraints, and
 * checks the row, position, recipe_count, collection_count and duplicate handling.
 */

import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const COLLECTION = '11111111-0000-4000-8000-000000000001';
const R1 = 'aaaaaaaa-0000-4000-8000-00000000000a';
const R2 = 'bbbbbbbb-0000-4000-8000-00000000000b';
const PRIVATE_RECIPE = 'cccccccc-0000-4000-8000-00000000000c';

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
vi.mock('@/app/actions/user-profiles', () => ({ ensureUserProfile: vi.fn(async () => ({})) }));

import { addRecipeToCollection } from '@/app/actions/collections';
import * as schema from '@/lib/db/schema';
import * as discovery from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;

function recipeRow(id: string, userId: string, isPublic: boolean) {
  return {
    id,
    user_id: userId,
    name: `Recipe ${id.slice(0, 2)}`,
    ingredients: '["1 cup water"]',
    instructions: '[]',
    is_public: isPublic,
  };
}

const db = () => state.db as any;

beforeAll(async () => {
  const created = await createVisibilityDb(
    [schema.recipes, discovery.collections, discovery.collectionRecipes],
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
  for (const t of ['collection_recipes', 'collections', 'recipes']) {
    await client.exec(`DELETE FROM "${t}";`);
  }
  await db()
    .insert(schema.recipes)
    .values([
      recipeRow(R1, OTHER, true),
      recipeRow(R2, OWNER, false),
      recipeRow(PRIVATE_RECIPE, OTHER, false),
    ]);
  await db()
    .insert(discovery.collections)
    .values({ id: COLLECTION, user_id: OWNER, name: 'Mine', slug: 'mine' });
  state.auth.mockResolvedValue({ userId: OWNER, sessionClaims: { metadata: {} } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const rows = () =>
  db()
    .select()
    .from(discovery.collectionRecipes)
    .where(eq(discovery.collectionRecipes.collection_id, COLLECTION));

describe('addRecipeToCollection (#43)', () => {
  it('inserts the row and returns success for an owner adding a visible recipe', async () => {
    const result = await addRecipeToCollection(COLLECTION, R1, 'tasty');

    expect(result.success).toBe(true);
    const inserted = await rows();
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ recipe_id: R1, position: 0, personal_note: 'tasty' });
  });

  it('assigns increasing positions and bumps recipe_count and collection_count', async () => {
    await addRecipeToCollection(COLLECTION, R1);
    await addRecipeToCollection(COLLECTION, R2);

    const inserted = (await rows()).sort((a: any, b: any) => a.position - b.position);
    expect(inserted.map((r: any) => [r.recipe_id, r.position])).toEqual([
      [R1, 0],
      [R2, 1],
    ]);
    const [collection] = await db().select().from(discovery.collections);
    expect(collection.recipe_count).toBe(2);
    expect(collection.last_recipe_added_at).toBeInstanceOf(Date);
    const [r1] = await db().select().from(schema.recipes).where(eq(schema.recipes.id, R1));
    expect(r1.collection_count).toBe(1);
  });

  it('answers a duplicate add with an error, no extra row and no count change', async () => {
    await addRecipeToCollection(COLLECTION, R1);
    const again = await addRecipeToCollection(COLLECTION, R1);

    expect(again).toEqual({ success: false, error: 'Recipe already in this collection' });
    expect(await rows()).toHaveLength(1);
    const [collection] = await db().select().from(discovery.collections);
    expect(collection.recipe_count).toBe(1);
  });

  it('keeps the #41 visibility gate: a private recipe of another user is not found', async () => {
    const result = await addRecipeToCollection(COLLECTION, PRIVATE_RECIPE);

    expect(result).toEqual({ success: false, error: 'Recipe not found' });
    expect(await rows()).toHaveLength(0);
  });
});
