// @vitest-environment node
/**
 * #134: the single-recipe server actions answer a private recipe the caller may not
 * see exactly as they answer a recipe that does not exist.
 *
 * Their action IDs ship in the client bundle, so anyone can POST them directly. A
 * distinct answer for a hidden recipe ("Access denied", "You do not have permission")
 * tells the caller the private recipe exists (#32 rule, `src/lib/recipe-visibility.ts`).
 * Each action runs against real Postgres (PGlite).
 */

import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const OTHER = 'user_other';
const PUBLIC_ID = 'aaaaaaaa-0000-4000-8000-00000000000a';
const PRIVATE_ID = 'bbbbbbbb-0000-4000-8000-00000000000b';
const MISSING_ID = 'cccccccc-0000-4000-8000-00000000000c';
const PRIVATE_SLUG = 'secret-stew';
const MISSING_SLUG = 'no-such-recipe';
const SECRET = 'Secret Stew';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  userId: null as string | null,
}));

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

import { getRecipeIngredients } from '@/app/actions/ingredient-search';
import {
  deleteRecipe,
  getRecipe,
  getRecipeBySlug,
  toggleRecipeVisibility,
  updateRecipe,
} from '@/app/actions/recipes';
import { ingredients, recipeIngredients } from '@/lib/db/ingredients-schema';
import * as schema from '@/lib/db/schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;
let db: Awaited<ReturnType<typeof createVisibilityDb>>['db'];

function row(id: string, slug: string, isPublic: boolean, name: string) {
  return {
    id,
    slug,
    user_id: OWNER,
    name,
    description: `${name} description`,
    ingredients: '[]',
    instructions: '[]',
    is_public: isPublic,
    is_system_recipe: false,
    fork_count: 0,
    like_count: 0,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
}

const ACTIONS: { name: string; run: (key: 'private' | 'missing') => Promise<unknown> }[] = [
  {
    name: 'getRecipe by slug',
    run: (k) => getRecipe(k === 'private' ? PRIVATE_SLUG : MISSING_SLUG),
  },
  { name: 'getRecipe by id', run: (k) => getRecipe(k === 'private' ? PRIVATE_ID : MISSING_ID) },
  {
    name: 'getRecipeBySlug',
    run: (k) => getRecipeBySlug(k === 'private' ? PRIVATE_SLUG : MISSING_SLUG),
  },
  {
    name: 'getRecipeIngredients',
    run: (k) => getRecipeIngredients(k === 'private' ? PRIVATE_ID : MISSING_ID),
  },
  {
    name: 'updateRecipe',
    run: (k) => updateRecipe(k === 'private' ? PRIVATE_ID : MISSING_ID, { name: 'Taken' }),
  },
  { name: 'deleteRecipe', run: (k) => deleteRecipe(k === 'private' ? PRIVATE_ID : MISSING_ID) },
  {
    name: 'toggleRecipeVisibility',
    run: (k) => toggleRecipeVisibility(k === 'private' ? PRIVATE_ID : MISSING_ID),
  },
];

beforeAll(async () => {
  const built = await createVisibilityDb([schema.recipes, recipeIngredients, ingredients], schema);
  client = built.client;
  db = built.db;
  state.db = built.db;
  await db
    .insert(schema.recipes)
    .values([
      row(PUBLIC_ID, 'open-soup', true, 'Open Soup'),
      row(PRIVATE_ID, PRIVATE_SLUG, false, SECRET),
    ]);
});

afterAll(async () => {
  await client?.close();
});

describe('#134 single-recipe actions: a hidden recipe answers as a missing one', () => {
  for (const viewer of [null, OTHER]) {
    for (const action of ACTIONS) {
      it(`${action.name} — ${viewer ?? 'anonymous'}`, async () => {
        state.userId = viewer;
        const hidden = await action.run('private');
        const missing = await action.run('missing');

        expect(hidden).toEqual(missing);
        expect(JSON.stringify(hidden)).not.toContain(SECRET);
      });
    }
  }

  it('the denied mutations leave the private recipe untouched', async () => {
    const [stored] = await db
      .select()
      .from(schema.recipes)
      .where(eq(schema.recipes.id, PRIVATE_ID));
    expect(stored).toMatchObject({ name: SECRET, is_public: false });
  });

  it('the owner still gets the private recipe', async () => {
    state.userId = OWNER;
    for (const result of [
      await getRecipe(PRIVATE_SLUG),
      await getRecipe(PRIVATE_ID),
      await getRecipeBySlug(PRIVATE_SLUG),
    ]) {
      expect(result).toMatchObject({ success: true, data: { id: PRIVATE_ID, name: SECRET } });
    }
    expect(await getRecipeIngredients(PRIVATE_ID)).toMatchObject({ success: true });
  });

  it('a visible recipe the caller does not own still names the permission problem', async () => {
    state.userId = OTHER;
    expect(await updateRecipe(PUBLIC_ID, { name: 'Taken' })).toEqual({
      success: false,
      error: 'You do not have permission to edit this recipe',
    });
  });
});
