// @vitest-environment node
/**
 * #217: while an owner's account deletion is pending, their public meals appear
 * in no public listing or lookup (metadata included), and the account can
 * neither create a meal nor edit (and so publish) one.
 * Reads: the filter is read-time only (`ownerVisibleTo`), so meals keep
 * `is_public`, the owner still sees their own, and `restoreAccount` brings them
 * back unchanged. Writes: the guard rides in the write statement itself
 * (`insertUnlessPendingDeletion`, or the UPDATE's WHERE), as in #208 and #210.
 * Real server actions and v1 routes against PGlite.
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
// A session caller: the v1 meal routes call server actions that read the
// session user (getSessionUserId), so API-key auth is not covered here.
vi.mock('@/lib/api-auth/middleware', () => ({
  authenticateRequest: async () =>
    state.userId
      ? { authenticated: true, userId: state.userId, authType: 'session', scopes: ['*'] }
      : { authenticated: false, error: 'Authentication required' },
  authHasAllScopes: () => true,
  authHasAnyScope: () => true,
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { saveMealPlanFromPairing } from '@/app/actions/meal-pairing';
import {
  createMeal,
  createMealFromTemplate,
  generateShoppingList,
  getMealById,
  getMealBySlug,
  getPublicMeals,
  getUserMeals,
  updateMeal,
} from '@/app/actions/meals';
import { GET as mealGET, PATCH as mealPATCH } from '@/app/api/v1/meals/[id]/route';
import { GET as shoppingListGET } from '@/app/api/v1/meals/[id]/shopping-list/route';
import { POST as mealsPOST } from '@/app/api/v1/meals/route';
import { generateMetadata } from '@/app/meals/[slug]/page';
import { markAccountDeleted, restoreAccount } from '@/lib/account-deletion';
import {
  isPendingDeletionRefusal,
  pendingDeletionError,
} from '@/lib/account-deletion/guarded-insert';
import type { RouteContext } from '@/lib/api-auth/types';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';

const PENDING = 'user_pending';
const NORMAL = 'user_normal';
const LEGACY = 'user_legacy_no_users_row';
const VIEWER = 'user_viewer';
// Not pending, private profile, public meal: pins that the filter is the
// deletion state, not user_profiles.is_public (which would hide this meal).
const PRIVATE_PROFILE = 'user_private_profile';
const OWNERS = [PENDING, NORMAL, LEGACY, PRIVATE_PROFILE];
const RECIPE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const TEMPLATE = 'bbbbbbbb-0000-4000-8000-00000000000b';
const REQUESTED_AT = new Date('2026-10-01T00:00:00.000Z');
const mealIdOf = (owner: string) => `11111111-0000-4000-8000-00000000000${OWNERS.indexOf(owner)}`;
const draftIdOf = (owner: string) => `22222222-0000-4000-8000-00000000000${OWNERS.indexOf(owner)}`;
const slugOf = (owner: string) => `${owner}-feast`;

let client: PGlite;

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

/** Every meal row as stored, to prove a read wrote nothing and a refusal changed nothing. */
async function mealRows() {
  return rows(
    'SELECT id, user_id, name, is_public, slug, updated_at FROM meals ORDER BY created_at, id'
  );
}

async function snapshot() {
  return {
    meals: await mealRows(),
    mealRecipes: await rows('SELECT meal_id, recipe_id FROM meal_recipes ORDER BY meal_id'),
    templates: await rows('SELECT id, times_used FROM meal_templates'),
  };
}

async function api(
  handler: (req: NextRequest, ctx: RouteContext) => Promise<Response>,
  path: string,
  init: { method?: string; body?: unknown; id?: string } = {}
): Promise<{ status: number; body: any }> {
  const req = new NextRequest(`http://localhost${path}`, {
    method: init.method ?? 'GET',
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const res = await handler(req, { params: Promise.resolve({ id: init.id }) } as RouteContext);
  return { status: res.status, body: await res.json() };
}

/**
 * One entry per public read path. `sees(owner)` answers whether the caller
 * (state.userId, null for anonymous) got the owner's public meal.
 */
const READS: Array<{ name: string; sees: (owner: string) => Promise<boolean> }> = [
  {
    name: 'getPublicMeals (/meals)',
    sees: async (owner) => {
      const r = await getPublicMeals();
      return r.success && (r.data ?? []).some((m) => m.user_id === owner);
    },
  },
  {
    name: 'getMealById',
    sees: async (owner) => {
      const r = await getMealById(mealIdOf(owner));
      return r.success && r.data?.recipes.some((x) => x.recipe.id === RECIPE) === true;
    },
  },
  {
    name: 'getMealBySlug (/meals/[slug])',
    sees: async (owner) => (await getMealBySlug(slugOf(owner))).success,
  },
  {
    name: 'generateMetadata (/meals/[slug] title)',
    sees: async (owner) => {
      const meta = await generateMetadata({ params: Promise.resolve({ slug: slugOf(owner) }) });
      return meta.title === `${owner} feast`;
    },
  },
  {
    name: 'generateShoppingList (reads the meal and its recipes)',
    sees: async (owner) => {
      const r = await generateShoppingList({ mealId: mealIdOf(owner) });
      // #225: the order is deliberate. generateShoppingList reads the meal first and
      // refuses a pending-deletion caller's write only after, so a refusal means it saw it.
      return r.success || isPendingDeletionRefusal(r);
    },
  },
  {
    name: 'GET /api/v1/meals/:id',
    sees: async (owner) => {
      const id = mealIdOf(owner);
      const r = await api(mealGET, `/api/v1/meals/${id}`, { id });
      return r.status === 200 && r.body.data?.user_id === owner;
    },
  },
  {
    name: 'GET /api/v1/meals/:id/shopping-list',
    sees: async (owner) => {
      const id = mealIdOf(owner);
      return (
        (await api(shoppingListGET, `/api/v1/meals/${id}/shopping-list`, { id })).status === 200
      );
    },
  },
];

// These need a signed-in caller; the others also run anonymously.
const SIGNED_IN = new Set([
  'generateShoppingList (reads the meal and its recipes)',
  'GET /api/v1/meals/:id',
  'GET /api/v1/meals/:id/shopping-list',
]);

type Outcome = { ok: true } | { refused: string; status?: number };

async function action(call: () => Promise<{ success: boolean; error?: string }>): Promise<Outcome> {
  const result = await call();
  return result.success ? { ok: true } : { refused: result.error ?? '' };
}

async function route(call: () => Promise<{ status: number; body: any }>): Promise<Outcome> {
  const r = await call();
  return r.status < 300 ? { ok: true } : { refused: r.body.error, status: r.status };
}

/**
 * One entry per guarded meal write. `verb` is the SQL statement kind that must
 * carry the guard; `action` names the refused action; `status` is a route's answer.
 */
const WRITES: Array<{
  name: string;
  verb: 'insert' | 'update';
  action: string;
  status?: number;
  run: (userId: string) => Promise<Outcome>;
}> = [
  {
    name: 'createMeal (server action)',
    verb: 'insert',
    action: 'create meals',
    run: () => action(() => createMeal({ name: 'Picnic', description: 'Sun', is_public: true })),
  },
  {
    name: 'POST /api/v1/meals',
    verb: 'insert',
    action: 'create meals',
    status: 403,
    run: () =>
      route(() =>
        api(mealsPOST, '/api/v1/meals', {
          method: 'POST',
          body: { name: 'Picnic', description: 'Sun', is_public: true },
        })
      ),
  },
  {
    name: 'createMealFromTemplate (server action)',
    verb: 'insert',
    action: 'create meals',
    run: () => action(() => createMealFromTemplate({ templateId: TEMPLATE, mealName: 'Roast' })),
  },
  {
    name: 'saveMealPlanFromPairing (server action)',
    verb: 'insert',
    action: 'create meals',
    run: () =>
      action(() =>
        saveMealPlanFromPairing(
          {
            appetizer: { name: 'a' },
            main: { name: 'm' },
            side: { name: 's' },
            dessert: { name: 'd' },
            meal_analysis: { total_prep_time: 1, color_palette: [], cultural_coherence: 'x' },
          } as any,
          'Plan'
        )
      ),
  },
  {
    name: 'updateMeal publishing a private meal (server action)',
    verb: 'update',
    action: 'edit meals',
    run: (u) => action(() => updateMeal(draftIdOf(u), { is_public: true })),
  },
  {
    name: 'PATCH /api/v1/meals/:id publishing a private meal',
    verb: 'update',
    action: 'edit meals',
    status: 403,
    run: (u) =>
      route(() =>
        api(mealPATCH, `/api/v1/meals/${draftIdOf(u)}`, {
          method: 'PATCH',
          body: { is_public: true },
          id: draftIdOf(u),
        })
      ),
  },
];

const refusalOf = (w: (typeof WRITES)[number]) =>
  w.status
    ? { refused: pendingDeletionError(w.action), status: w.status }
    : { refused: pendingDeletionError(w.action) };

// Case-insensitive: drizzle's plain `.insert()` writes `insert into`, the guarded CTE `INSERT INTO`.
const writesMeals = (text: string, verb: 'insert' | 'update') =>
  verb === 'insert' ? /INSERT INTO "meals"/i.test(text) : /^\s*update "meals"/i.test(text);

/** Every SQL text the drizzle client sends while `call` runs. */
async function statementsOf(call: () => Promise<unknown>): Promise<string[]> {
  const query = vi.spyOn(client, 'query');
  await call();
  const texts = query.mock.calls.map(([text]) => String(text));
  query.mockRestore();
  return texts;
}

/** Sets `userId`'s deletion flag inside the meal write's own call, after every earlier read. */
function requestDeletionAtMealWrite(userId: string, verb: 'insert' | 'update') {
  const original = client.query.bind(client);
  vi.spyOn(client, 'query').mockImplementation((async (text: string, ...rest: unknown[]) => {
    if (writesMeals(String(text), verb)) {
      await original('UPDATE users SET deletion_requested_at = now() WHERE id = $1', [userId]);
    }
    return (original as (...a: unknown[]) => unknown)(text, ...rest);
  }) as typeof client.query);
}

beforeAll(async () => {
  const built = await createVisibilityDb(
    [
      users,
      schema.recipes,
      userProfiles,
      schema.meals,
      schema.mealRecipes,
      schema.shoppingLists,
      schema.mealTemplates,
      schema.ingredients,
    ],
    { ...schema, userProfiles },
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
  await client.exec(`DELETE FROM shopping_lists; DELETE FROM meal_recipes; DELETE FROM meals;
    DELETE FROM meal_templates; DELETE FROM user_profiles; DELETE FROM recipes; DELETE FROM users;`);
  // LEGACY has no users row (pre-Auth.js id).
  await rows(
    `INSERT INTO users (id, name, email) VALUES
      ($1, 'Pending', 'p@example.test'), ($2, 'Normal', 'n@example.test'),
      ($3, 'Viewer', 'v@example.test'), ($4, 'Private', 'pp@example.test')`,
    [PENDING, NORMAL, VIEWER, PRIVATE_PROFILE]
  );
  await client.exec(`INSERT INTO recipes (id, user_id, name, ingredients, instructions,
      is_public, moderation_status) VALUES
    ('${RECIPE}', '${VIEWER}', 'Soup', '["1 leek"]', '[]', true, 'approved')`);
  await client.exec(`INSERT INTO meal_templates (id, name, template_structure, times_used)
    VALUES ('${TEMPLATE}', 'Sunday Roast', '{}', 2)`);
  for (const owner of OWNERS) {
    await rows(
      `INSERT INTO user_profiles (user_id, username, display_name, is_public)
        VALUES ($1, $2, $2, $3)`,
      [owner, `${owner}-name`, owner !== PRIVATE_PROFILE]
    );
    await rows(
      `INSERT INTO meals (id, user_id, name, description, is_public, slug) VALUES
        ($1, $2, $3, 'Shared', true, $4), ($5, $2, 'Draft', 'Mine', false, $6)`,
      [mealIdOf(owner), owner, `${owner} feast`, slugOf(owner), draftIdOf(owner), `${owner}-draft`]
    );
    await rows('INSERT INTO meal_recipes (meal_id, recipe_id) VALUES ($1, $2)', [
      mealIdOf(owner),
      RECIPE,
    ]);
  }
  await markAccountDeleted(PENDING, true, REQUESTED_AT);
});

afterEach(() => {
  vi.restoreAllMocks();
  state.userId = null;
});

describe.each(READS)('#217 read: $name', (path) => {
  const viewers = SIGNED_IN.has(path.name) ? [VIEWER] : [null, VIEWER];

  it.each(viewers)(
    'viewer %s: pending owner absent; normal and legacy owners present',
    async (v) => {
      state.userId = v;

      expect(await path.sees(PENDING)).toBe(false);
      expect(await path.sees(NORMAL)).toBe(true);
      expect(await path.sees(LEGACY)).toBe(true);
    }
  );

  it.each(viewers)(
    'viewer %s: a normal owner with a private profile keeps their public meal listed',
    async (v) => {
      state.userId = v;

      expect(await path.sees(PRIVATE_PROFILE)).toBe(true);
    }
  );

  it('the pending owner still sees their own meal', async () => {
    state.userId = PENDING;

    expect(await path.sees(PENDING)).toBe(true);
  });

  it('after restoreAccount the meal is visible again, with no meal row changed', async () => {
    const before = await mealRows();
    state.userId = VIEWER;
    expect(await path.sees(PENDING)).toBe(false);

    await restoreAccount(PENDING, REQUESTED_AT);

    expect(await path.sees(PENDING)).toBe(true);
    expect(await mealRows()).toEqual(before);
  });
});

describe('#217 a private meal stays private on the by-id and by-slug lookups', () => {
  // Pins the `or(user_id = viewer, is_public)` branch the #217 filter was ANDed onto.
  it.each([
    ['getMealById', () => getMealById(draftIdOf(NORMAL))],
    ['getMealBySlug', () => getMealBySlug(`${NORMAL}-draft`)],
  ])(
    '%s: another viewer and an anonymous caller get nothing; the owner gets it',
    async (_n, call) => {
      for (const v of [VIEWER, null]) {
        state.userId = v;
        expect(await call()).toEqual({ success: false, error: 'Meal not found' });
      }

      state.userId = NORMAL;
      expect(await call()).toMatchObject({ success: true, data: { id: draftIdOf(NORMAL) } });
    }
  );
});

describe('#217 the owner-only view is unchanged', () => {
  it("getUserMeals lists the pending owner's own meals, public and private", async () => {
    state.userId = PENDING;

    const r = await getUserMeals();

    expect(r.success && r.data?.map((m) => m.id).sort()).toEqual(
      [mealIdOf(PENDING), draftIdOf(PENDING)].sort()
    );
  });
});

describe('#217 meal writes refuse an account with a pending deletion', () => {
  it.each(WRITES)('$name: refuses and writes nothing', async (w) => {
    state.userId = PENDING;
    const before = await snapshot();

    expect(await w.run(PENDING)).toEqual(refusalOf(w));

    expect(await snapshot()).toEqual(before);
  });

  it.each(WRITES)(
    '$name: refuses when the deletion is requested after every read before the statement',
    async (w) => {
      // A guard in a separate query before the statement passes here and the write lands.
      requestDeletionAtMealWrite(NORMAL, w.verb);
      state.userId = NORMAL;
      const before = await snapshot();

      expect(await w.run(NORMAL)).toEqual(refusalOf(w));

      expect(await snapshot()).toEqual(before);
    }
  );

  // A normal user, so the write runs whatever any pre-check would answer.
  it.each(WRITES)('$name: one meal write statement, carrying the guard', async (w) => {
    state.userId = NORMAL;

    const texts = await statementsOf(() => w.run(NORMAL));

    const writes = texts.filter((t) => writesMeals(t, w.verb)).map((t) => t.replace(/\s+/g, ' '));
    expect(writes).toHaveLength(1);
    const guard =
      'NOT EXISTS \\(SELECT 1 FROM "users" WHERE "users"\\."id" = \\$\\d+ AND "users"\\."deletion_requested_at" IS NOT NULL\\)';
    expect(writes[0]).toMatch(
      w.verb === 'insert'
        ? new RegExp(
            `^ WITH allowed AS \\( SELECT 1 AS ok WHERE ${guard} \\), inserted AS \\( INSERT INTO "meals" \\([^)]*\\) SELECT .* FROM allowed `
          )
        : new RegExp(`^update "meals" set .* where .*${guard}`)
    );
  });
});

describe('#217 meal writes are unchanged for other accounts', () => {
  it.each(
    WRITES.flatMap((w) => [
      { ...w, who: 'a users row with no pending deletion', userId: NORMAL },
      { ...w, who: 'a legacy id with no users row', userId: LEGACY },
    ])
  )('$name, $who: writes', async (w) => {
    state.userId = w.userId;
    const before = await mealRows();

    expect(await w.run(w.userId)).toEqual({ ok: true });

    const after = await mealRows();
    if (w.verb === 'insert') {
      expect(after).toHaveLength(before.length + 1);
    } else {
      expect(after.find((m) => m.id === draftIdOf(w.userId))?.is_public).toBe(true);
    }
  });

  it('updateMeal on a meal the caller does not own still answers "Meal not found"', async () => {
    state.userId = NORMAL;

    expect(await updateMeal(draftIdOf(LEGACY), { is_public: true })).toEqual({
      success: false,
      error: 'Meal not found',
    });
  });

  it('after restoreAccount the account creates and publishes meals again', async () => {
    await restoreAccount(PENDING, REQUESTED_AT);
    state.userId = PENDING;

    expect(await updateMeal(draftIdOf(PENDING), { is_public: true })).toMatchObject({
      success: true,
    });
    expect(await createMeal({ name: 'Back', description: 'Again' })).toMatchObject({
      success: true,
    });
  });
});
