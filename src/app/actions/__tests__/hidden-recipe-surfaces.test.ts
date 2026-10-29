// @vitest-environment node
/**
 * #102: a hidden (moderation_status = 'rejected') recipe stays out of ingredient
 * search even when it is a system recipe, and the paginated API never lets a
 * shared cache store a response that carries one.
 */

import type { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN = 'user_admin';
const OWNER = 'owner';
const SHOWN = 'sys-shown';
const HIDDEN = 'sys-hidden';
const PUB = 'pub-ok';
const PRIV = 'priv-hidden';
const ING = '77777777-7777-4777-8777-777777777777';

const state = vi.hoisted(() => ({ db: undefined as unknown, userId: null as string | null }));

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ userId: state.userId, sessionClaims: null }),
}));
vi.mock('@/lib/auth-users', () => ({
  getUserAdminFlag: async (userId: string) => userId === ADMIN,
}));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { searchRecipesByIngredients } from '@/app/actions/ingredient-search';
import { GET } from '@/app/api/recipes/paginated/route';
import { searchCaches } from '@/lib/cache';
import { ingredients, recipeIngredients } from '@/lib/db/ingredients-schema';
import * as schema from '@/lib/db/schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;

function row(id: string, over: Record<string, unknown>) {
  return {
    id,
    user_id: OWNER,
    name: id,
    ingredients: '[]',
    instructions: '[]',
    is_public: true,
    is_system_recipe: false,
    moderation_status: 'approved' as const,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

beforeAll(async () => {
  const made = await createVisibilityDb([schema.recipes, ingredients, recipeIngredients], {
    ...schema,
    ingredients,
    recipeIngredients,
  });
  client = made.client;
  state.db = made.db;
});

beforeEach(async () => {
  state.userId = null;
  searchCaches.ingredient.clear();
  for (const t of ['recipes', 'ingredients', 'recipe_ingredients']) {
    await client.exec(`DELETE FROM "${t}";`);
  }
  const db = state.db as any;
  await db
    .insert(ingredients)
    .values({ id: ING, name: 'salt', display_name: 'Salt', slug: 'salt' });
  await db.insert(schema.recipes).values([
    row(SHOWN, { user_id: 'system', is_public: false, is_system_recipe: true }),
    row(HIDDEN, {
      user_id: 'system',
      is_public: false,
      is_system_recipe: true,
      moderation_status: 'rejected',
    }),
    row(PUB, {}),
    row(PRIV, { moderation_status: 'rejected' }),
  ]);
  await db.insert(recipeIngredients).values(
    [SHOWN, HIDDEN, PUB, PRIV].map((recipe_id, i) => ({
      id: `88888888-8888-4888-8888-88888888888${i}`,
      recipe_id,
      ingredient_id: ING,
    }))
  );
});

describe('ingredient search', () => {
  it('withholds a hidden system recipe from an anonymous caller', async () => {
    const result = await searchRecipesByIngredients(['salt'], { matchMode: 'any' });
    expect(result.success).toBe(true);
    const ids = result.recipes.map((r) => r.id).sort();
    expect(ids).toEqual([PUB, SHOWN].sort());
  });
});

describe('paginated recipes cache header', () => {
  const get = () =>
    GET(new NextRequest('http://localhost/api/recipes/paginated?limit=50')) as Promise<Response>;

  it('is public for an all-public response', async () => {
    const res = await get();
    expect(res.headers.get('Cache-Control')).toBe(
      'public, s-maxage=60, stale-while-revalidate=120'
    );
  });

  it('is private, no-store when an admin response includes a hidden recipe', async () => {
    // The list route only shows an admin their own rows plus public ones.
    await (state.db as any)
      .insert(schema.recipes)
      .values(row('admin-hidden', { user_id: ADMIN, moderation_status: 'rejected' }));
    state.userId = ADMIN;
    const res = await get();
    const body = (await res.json()) as { recipes: { id: string }[] };
    expect(body.recipes.some((r) => r.id === 'admin-hidden')).toBe(true);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('is private, no-store when an owner response includes their hidden recipe', async () => {
    state.userId = OWNER;
    const res = await get();
    const body = (await res.json()) as { recipes: { id: string }[] };
    expect(body.recipes.some((r) => r.id === PRIV)).toBe(true);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
