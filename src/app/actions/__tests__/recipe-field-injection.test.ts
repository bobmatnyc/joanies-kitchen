/**
 * #33: createRecipe and updateRecipe write only allowlisted columns. A
 * signed-in non-admin who posts server-controlled columns (owner, system flag,
 * chef attribution, license, moderation, ratings/counters, ids, timestamps)
 * must not see them reach the database row. The fake db captures the exact
 * object handed to `insert().values()` / `update().set()`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sessionUserId: vi.fn(),
  isAdmin: false,
  inserted: [] as Record<string, unknown>[],
  updated: [] as Record<string, unknown>[],
  existing: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/session-user', () => ({ getSessionUserId: mocks.sessionUserId }));
// #22: admin is read from users.is_admin; the fixture flag stands in for the row.
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => mocks.isAdmin }));
vi.mock('@/lib/utils/slug', () => ({ generateUniqueSlug: async () => 'server-slug' }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/cache', () => ({
  invalidateRecipeCaches: vi.fn(),
  invalidateRecipeById: vi.fn(),
}));
vi.mock('@/lib/db', () => {
  const selectChain = {
    from: () => selectChain,
    where: () => selectChain,
    limit: async () => mocks.existing,
  };
  return {
    db: {
      select: () => selectChain,
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          mocks.inserted.push(row);
          return { returning: async () => [row] };
        },
      }),
      update: () => ({
        set: (row: Record<string, unknown>) => {
          mocks.updated.push(row);
          return { where: () => ({ returning: async () => [row] }) };
        },
      }),
    },
  };
});

import { createRecipe, updateRecipe } from '@/app/actions/recipes';

const OWNER = 'user_1';
const RECIPE_ID = '11111111-1111-4111-8111-111111111111';
const PAST = new Date('2000-01-01T00:00:00Z');

const BASE = {
  name: 'Soup',
  ingredients: '["water"]',
  instructions: '["boil"]',
  is_public: true,
};

// #33: each injected column with the value an attacker would send.
const INJECTED: Record<string, unknown> = {
  is_system_recipe: true,
  chef_id: '22222222-2222-4222-8222-222222222222',
  license: 'PUBLIC_DOMAIN',
  user_id: 'victim_user',
  id: 'attacker-chosen-id',
  slug: 'attacker-slug',
  created_at: PAST,
  updated_at: PAST,
  moderation_status: 'approved',
  moderated_by: OWNER,
  moderated_at: PAST,
  system_rating: '5.0',
  avg_user_rating: '5.0',
  total_user_ratings: 9999,
  like_count: 9999,
  fork_count: 9999,
  collection_count: 9999,
  resourcefulness_score: 5,
  qa_status: 'validated',
  deleted_at: PAST,
  deleted_by: OWNER,
  content_flagged_for_cleanup: true,
  image_flagged_for_regeneration: true,
};

// #33: columns createRecipe fills with its own value rather than dropping.
const SERVER_VALUE: Record<string, unknown> = { user_id: OWNER, slug: 'server-slug' };

function signedIn(isAdmin: boolean) {
  mocks.isAdmin = isAdmin;
  mocks.sessionUserId.mockResolvedValue(OWNER);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inserted = [];
  mocks.updated = [];
  mocks.existing = [{ id: RECIPE_ID, user_id: OWNER, is_system_recipe: false }];
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

// createRecipe already overwrote user_id and slug after its spread before #33;
// the admin case below still asserts user_id.
const CREATE_FIELDS = Object.keys(INJECTED).filter((f) => !(f in SERVER_VALUE));

describe('#33 createRecipe ignores server-controlled fields from a non-admin', () => {
  it.each(CREATE_FIELDS)('ignores %s', async (field) => {
    signedIn(false);
    const result = await createRecipe({ ...BASE, [field]: INJECTED[field] } as never);

    expect(result.success).toBe(true);
    expect(mocks.inserted).toHaveLength(1);
    expect(mocks.inserted[0][field]).toBeUndefined();
    expect(mocks.inserted[0].name).toBe('Soup');
    expect(mocks.inserted[0].is_public).toBe(true);
  });
});

describe('#33 updateRecipe ignores server-controlled fields from a non-admin owner', () => {
  it.each(Object.keys(INJECTED).filter((f) => f !== 'slug'))('ignores %s', async (field) => {
    signedIn(false);
    const result = await updateRecipe(RECIPE_ID, {
      name: 'Stew',
      [field]: INJECTED[field],
    } as never);

    expect(result.success).toBe(true);
    expect(mocks.updated).toHaveLength(1);
    const row = mocks.updated[0];
    if (field === 'updated_at') {
      expect(row.updated_at).toBeInstanceOf(Date);
      expect(row.updated_at).not.toEqual(PAST);
    } else {
      expect(row[field]).toBeUndefined();
    }
    expect(row.name).toBe('Stew');
  });
});

describe('#33 admin-only recipe fields', () => {
  it('createRecipe keeps is_system_recipe, chef_id and license for an admin', async () => {
    signedIn(true);
    await createRecipe({
      ...BASE,
      is_system_recipe: true,
      chef_id: INJECTED.chef_id,
      license: 'PUBLIC_DOMAIN',
      user_id: 'victim_user',
    } as never);

    const row = mocks.inserted[0];
    expect(row.is_system_recipe).toBe(true);
    expect(row.chef_id).toBe(INJECTED.chef_id);
    expect(row.license).toBe('PUBLIC_DOMAIN');
    expect(row.user_id).toBe(OWNER);
  });
});
