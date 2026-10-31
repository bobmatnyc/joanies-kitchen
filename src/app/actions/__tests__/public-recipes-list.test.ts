// @vitest-environment node
/**
 * The /recipes page is public. Signed out, its data load returns public
 * recipes only, and a direct server-action call cannot pull more than one
 * capped page.
 */

import type { PGlite } from '@electric-sql/pglite';
import type { ReactElement } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const OWNER = 'user_owner';
const PUBLIC_ID = 'aaaaaaaa-0000-4000-8000-00000000000a';
const PRIVATE_ID = 'bbbbbbbb-0000-4000-8000-00000000000b';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  sessionUserId: undefined as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock('@/lib/session-user', () => {
  state.sessionUserId = vi.fn(async () => null);
  const getSessionUserId = (...args: unknown[]) => state.sessionUserId(...args);
  return {
    getSessionUserId,
    getSessionUser: async () => {
      const id = await getSessionUserId();
      return id ? { id } : null;
    },
  };
});
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { getRecipesPaginated } from '@/app/actions/recipes';
import RecipesPage from '@/app/recipes/page';
import { decideRoute } from '@/lib/auth-routes';
import * as schema from '@/lib/db/schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;

function row(id: string, isPublic: boolean, name: string) {
  return {
    id,
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

/** Finds the props of the first element in the tree that carries `initialRecipes`. */
function findListProps(node: unknown): { initialRecipes: Array<{ id: string }> } | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const props = (node as ReactElement<Record<string, unknown>>).props;
  if (!props) return undefined;
  if ('initialRecipes' in props) return props as { initialRecipes: Array<{ id: string }> };
  const children = props.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findListProps(child);
    if (found) return found;
  }
  return undefined;
}

beforeAll(async () => {
  const built = await createVisibilityDb([schema.recipes], schema);
  client = built.client;
  state.db = built.db;
  await (state.db as any)
    .insert(schema.recipes)
    .values([row(PUBLIC_ID, true, 'Open Soup'), row(PRIVATE_ID, false, 'Secret Stew')]);
});

afterAll(async () => {
  await client?.close();
});

describe('public /recipes list', () => {
  it('signed-out /recipes is allowed and renders only the public recipe', async () => {
    expect(decideRoute('/recipes', { userId: null, isAdmin: false })).toBe('allow');

    const tree = await RecipesPage({ searchParams: Promise.resolve({}) });
    const ids = findListProps(tree)?.initialRecipes.map((r) => r.id);
    expect(ids).toEqual([PUBLIC_ID]);
  });

  it('caps a direct server-action call at 100 rows per page', async () => {
    const result = await getRecipesPaginated({ page: 1, limit: 100000 });
    expect(result.data?.pagination.limit).toBe(100);
    expect(result.data?.recipes.map((r) => r.id)).toEqual([PUBLIC_ID]);
  });
});
