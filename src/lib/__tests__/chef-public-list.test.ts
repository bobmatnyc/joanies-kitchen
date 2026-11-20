// @vitest-environment node
/**
 * Public chef lists show only active chefs with >= 3 public recipes, counted
 * with the site's `publicRecipe` rule. Real queries against PGlite.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { listPublicChefs, MIN_PUBLIC_CHEF_RECIPES } from '@/lib/chef-public-list';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

let client: PGlite;

beforeAll(async () => {
  const tables = { recipes, chefs, chefRecipes };
  const built = await createVisibilityDb(Object.values(tables), tables, { constraints: true });
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

/** Seeds a chef linked to recipes given as [is_public, moderation_status, deleted]. */
async function seedChef(
  slug: string,
  recipeFlags: [boolean, string, boolean][],
  opts: { active?: boolean; storedCount?: number } = {}
) {
  const id = crypto.randomUUID();
  await client.query(
    'INSERT INTO "chefs" (id, slug, name, is_active, recipe_count) VALUES ($1, $2, $2, $3, $4)',
    [id, slug, opts.active ?? true, opts.storedCount ?? recipeFlags.length]
  );
  for (const [i, [isPublic, status, deleted]] of recipeFlags.entries()) {
    const rid = `${slug}-r${i}`;
    await client.query(
      `INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, is_public, moderation_status, deleted_at)
       VALUES ($1, 'u', $1, '[]', '[]', $2, $3, $4)`,
      [rid, isPublic, status, deleted ? new Date() : null]
    );
    await client.query('INSERT INTO "chef_recipes" (chef_id, recipe_id) VALUES ($1, $2)', [
      id,
      rid,
    ]);
  }
}

const PUB: [boolean, string, boolean] = [true, 'approved', false];

beforeEach(async () => {
  await client.exec('DELETE FROM "chef_recipes"; DELETE FROM "recipes"; DELETE FROM "chefs";');
});

describe('listPublicChefs', () => {
  it('uses a minimum of 3 public recipes', () => {
    expect(MIN_PUBLIC_CHEF_RECIPES).toBe(3);
  });

  it('lists chefs at or above the bar and excludes those below it', async () => {
    await seedChef('three', [PUB, PUB, PUB]);
    await seedChef('two', [PUB, PUB]);
    await seedChef('five', [PUB, PUB, PUB, PUB, PUB]);

    const listed = await listPublicChefs();
    expect(listed.map((c) => [c.slug, c.publicRecipeCount])).toEqual([
      ['five', 5],
      ['three', 3],
    ]);
  });

  it('counts only public recipes, not the stored recipe_count', async () => {
    // Six links, but only two are public: private, rejected, soft-deleted and a second private.
    await seedChef(
      'mostly-hidden',
      [
        PUB,
        PUB,
        [false, 'approved', false],
        [true, 'rejected', false],
        [true, 'approved', true],
        [false, 'pending', false],
      ],
      { storedCount: 6 }
    );
    expect(await listPublicChefs()).toEqual([]);
  });

  it('excludes inactive chefs', async () => {
    await seedChef('inactive', [PUB, PUB, PUB], { active: false });
    expect(await listPublicChefs()).toEqual([]);
  });
});
