// @vitest-environment node
/**
 * #220: every user-initiated recipe insert refuses an account whose deletion
 * is pending (`users.deletion_requested_at` set). The check rides in the
 * INSERT itself (`insertUnlessPendingDeletion`), so a refused write leaves no
 * recipe, no embedding, no fork_count bump and no favorite, and a deletion
 * requested after every earlier read still refuses. Ids with no `users` row
 * and accounts with no pending deletion write exactly as before.
 * Real server actions and the v1 route against PGlite tables carrying the
 * production foreign keys. AI, scrape, search and embedding calls are mocked.
 */

import type { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import { integer, pgEnum, pgSchema, pgTable, text } from 'drizzle-orm/pg-core';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  client: undefined as unknown,
  userId: null as string | null,
}));
const addFavorite = vi.hoisted(() => vi.fn(async () => ({ success: true })));

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
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  enforceRateLimit: async () => ({ allowed: true, count: 1, limit: 20 }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
// A session caller with every scope; no apiKeyId, so no api_key_usage tracking.
vi.mock('@/lib/api-auth/middleware', () => ({
  authenticateRequest: async () =>
    state.userId
      ? { authenticated: true, userId: state.userId, authType: 'session', scopes: ['*'] }
      : { authenticated: false, error: 'Authentication required' },
  authHasAllScopes: () => true,
  authHasAnyScope: () => true,
}));
vi.mock('@/app/actions/favorites', () => ({ addFavorite }));
vi.mock('@/lib/ai/recipe-parser', () => {
  const parse = async () => ({
    name: 'Parsed Stew',
    description: 'From the parser',
    ingredients: ['1 carrot'],
    instructions: ['Stew it'],
    prepTime: 10,
    cookTime: 20,
    servings: 2,
    difficulty: 'easy',
    cuisine: 'Irish',
    tags: ['winter'],
  });
  return { parseRecipeWithAI: parse, parseRecipeFromImage: parse };
});
vi.mock('@/lib/firecrawl', () => ({
  scrapeRecipePage: async () => ({ success: true, markdown: '# Stew', html: '', metadata: {} }),
}));
vi.mock('@/lib/recipe-discovery-steps', () => ({
  discoverRecipeUrls: async () => [{ url: 'https://example.test/stew', title: 'Stew' }],
  extractAndValidateRecipe: async () => ({
    success: true,
    confidenceScore: 0.9,
    recipe: {
      name: 'Found Stew',
      description: 'Found',
      ingredients: ['1 leek'],
      instructions: ['Cook'],
      prepTime: 5,
      cookTime: 15,
      servings: 3,
    },
  }),
  generateRecipeMetadata: async () => ({ cuisine: 'Irish', tags: ['found'], difficulty: 'easy' }),
}));
vi.mock('@/lib/recipes/dedup', () => ({
  findDuplicateRecipe: async () => null,
  duplicateRefusal: () => ({ error: 'duplicate' }),
  duplicateSkipReason: () => 'duplicate',
  isDisclosableDuplicate: () => false,
}));
vi.mock('@/lib/ai/embeddings', () => ({
  generateRecipeEmbedding: async () => ({
    embedding: [0.1, 0.2],
    embeddingText: 'stew',
    modelName: 'test-embedder',
  }),
}));
// The embedding is a dependent row: written after, and only after, the recipe lands.
vi.mock('@/lib/db/embeddings', () => ({
  saveRecipeEmbedding: async (recipeId: string, _e: number[], text: string, model: string) => {
    await (state.client as PGlite).query(
      'INSERT INTO recipe_embeddings (recipe_id, embedding_text, model_name) VALUES ($1, $2, $3)',
      [recipeId, text, model]
    );
  },
}));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { uploadRecipeFromUrl, uploadRecipeWithAI } from '@/app/actions/ai-upload';
import { cloneRecipe } from '@/app/actions/recipe-cloning';
import { discoverRecipeFromUrl, discoverRecipes } from '@/app/actions/recipe-discovery';
import { importRecipeFromMarkdown, importRecipesFromMarkdown } from '@/app/actions/recipe-import';
import { bulkImportRecipes, importWebRecipe } from '@/app/actions/recipe-search';
import { copyRecipeToCollection, createRecipe } from '@/app/actions/recipes';
import { POST as recipesPOST } from '@/app/api/v1/recipes/route';
import {
  insertUnlessPendingDeletion,
  pendingDeletionError,
} from '@/lib/account-deletion/guarded-insert';
import type { RouteContext } from '@/lib/api-auth/types';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';

const PENDING = 'user_pending';
const NORMAL = 'user_normal';
const LEGACY = 'user_legacy_no_users_row';
const OWNER = 'user_owner';
const ORIGINAL = 'aaaaaaaa-0000-4000-8000-00000000000a';
const REQUESTED_AT = new Date('2026-10-01T00:00:00.000Z');
const MARKDOWN = `---
title: Markdown Soup
servings: 4
---

## Ingredients

- 1 onion

## Instructions

1. Simmer
`;
const WEB_RECIPE = {
  name: 'Web Soup',
  description: 'From the web',
  ingredients: ['1 bean'],
  instructions: ['Boil'],
};

let client: PGlite;

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

/** Every row a recipe-creation path could write, in full. */
async function snapshot() {
  return {
    recipes: await rows('SELECT * FROM recipes ORDER BY id'),
    embeddings: await rows('SELECT * FROM recipe_embeddings ORDER BY recipe_id'),
    favorites: addFavorite.mock.calls.length,
  };
}

async function api(path: string, body: unknown): Promise<{ status: number; body: any }> {
  const req = new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const res = await recipesPOST(req, { params: Promise.resolve({}) } as RouteContext);
  return { status: res.status, body: await res.json() };
}

type Outcome = { ok: true } | { refused: string; status?: number };

async function action(call: () => Promise<{ success: boolean; error?: string }>): Promise<Outcome> {
  const result = await call();
  return result.success ? { ok: true } : { refused: result.error ?? '' };
}

/**
 * One entry per user-initiated recipe insert. `action` names the refused
 * action; `status` is a route's answer; `normal` overrides the outcome for an
 * account that may write (default `{ ok: true }`).
 */
const PATHS: Array<{
  name: string;
  action: string;
  status?: number;
  normal?: Outcome;
  run: () => Promise<Outcome>;
}> = [
  {
    name: 'createRecipe (server action)',
    action: 'create recipes',
    run: () =>
      action(() =>
        createRecipe({ name: 'Leek Soup', ingredients: '["1 leek"]', instructions: '["Simmer"]' })
      ),
  },
  {
    name: 'POST /api/v1/recipes',
    action: 'create recipes',
    status: 403,
    run: async () => {
      const r = await api('/api/v1/recipes', {
        name: 'Api Soup',
        ingredients: ['1 leek'],
        instructions: ['Simmer'],
      });
      return r.status < 300 ? { ok: true } : { refused: r.body.error, status: r.status };
    },
  },
  {
    name: 'importWebRecipe (server action, via createRecipe)',
    action: 'create recipes',
    run: () => action(() => importWebRecipe(WEB_RECIPE)),
  },
  {
    name: 'bulkImportRecipes (server action, via createRecipe)',
    action: 'create recipes',
    run: async () => {
      const r = await bulkImportRecipes([WEB_RECIPE]);
      return r.success ? { ok: true } : { refused: r.message };
    },
  },
  {
    name: 'copyRecipeToCollection (server action)',
    action: 'copy recipes',
    // Pre-existing: the copy keeps the original's id, so the insert hits the primary key.
    normal: { refused: 'Failed to copy recipe to collection' },
    run: () => action(() => copyRecipeToCollection(ORIGINAL)),
  },
  {
    name: 'cloneRecipe (server action)',
    action: 'clone recipes',
    run: () => action(() => cloneRecipe(ORIGINAL)),
  },
  {
    name: 'importRecipeFromMarkdown (server action)',
    action: 'import recipes',
    run: () => action(() => importRecipeFromMarkdown(MARKDOWN)),
  },
  {
    name: 'importRecipesFromMarkdown (server action)',
    action: 'import recipes',
    run: () => action(() => importRecipesFromMarkdown([{ name: 'a.md', content: MARKDOWN }])),
  },
  {
    name: 'uploadRecipeWithAI (server action)',
    action: 'upload recipes',
    run: () => action(() => uploadRecipeWithAI({ text: 'stew' })),
  },
  {
    name: 'uploadRecipeFromUrl (server action)',
    action: 'import recipes',
    run: () => action(() => uploadRecipeFromUrl('https://example.test/stew')),
  },
  {
    name: 'discoverRecipeFromUrl (server action)',
    action: 'save discovered recipes',
    run: () => action(() => discoverRecipeFromUrl('https://example.test/stew')),
  },
  {
    name: 'discoverRecipes (server action)',
    action: 'save discovered recipes',
    run: () => action(() => discoverRecipes('stew', { maxResults: 1 })),
  },
];

const refusalOf = (p: (typeof PATHS)[number]): Outcome =>
  p.status
    ? { refused: pendingDeletionError(p.action), status: p.status }
    : { refused: pendingDeletionError(p.action) };

// Case-insensitive: drizzle's plain `.insert()` writes `insert into`, the guarded CTE `INSERT INTO`.
const insertsRecipe = (text: string) => /INSERT INTO "recipes"/i.test(text);

/** Every SQL text the drizzle client sends while `call` runs. */
async function statementsOf(call: () => Promise<unknown>): Promise<string[]> {
  const query = vi.spyOn(client, 'query');
  await call();
  const texts = query.mock.calls.map(([t]) => String(t));
  query.mockRestore();
  return texts;
}

/** Sets `userId`'s deletion flag inside the recipe insert's own call, after every earlier read. */
function requestDeletionAtRecipeInsert(userId: string) {
  const original = client.query.bind(client);
  vi.spyOn(client, 'query').mockImplementation((async (t: string, ...rest: unknown[]) => {
    if (insertsRecipe(String(t))) {
      await original('UPDATE users SET deletion_requested_at = now() WHERE id = $1', [userId]);
    }
    return (original as (...a: unknown[]) => unknown)(t, ...rest);
  }) as typeof client.query);
}

beforeAll(async () => {
  const built = await createVisibilityDb([users, schema.recipes], schema, { constraints: true });
  client = built.client;
  state.client = client;
  state.db = built.db;
  // The production foreign keys of the rows these paths write (schema.ts).
  await client.exec(`
    CREATE TABLE "recipe_embeddings" ("recipe_id" text NOT NULL, "embedding_text" text NOT NULL,
      "model_name" varchar(100) NOT NULL);
    ALTER TABLE "recipe_embeddings" ADD FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE;`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  addFavorite.mockClear();
  await client.exec('DELETE FROM recipe_embeddings; DELETE FROM recipes; DELETE FROM users;');
  await rows(
    `INSERT INTO users (id, email, deletion_requested_at) VALUES
      ($1, 'p@example.test', $4), ($2, 'n@example.test', NULL), ($3, 'o@example.test', NULL)`,
    [PENDING, NORMAL, OWNER, REQUESTED_AT]
  );
  // fork_count starts non-zero, so a bump shows.
  await client.exec(`INSERT INTO recipes (id, user_id, name, ingredients, instructions,
      is_public, moderation_status, slug, fork_count) VALUES
    ('${ORIGINAL}', '${OWNER}', 'Soup', '["1 leek"]', '["Simmer"]', true, 'approved', 'soup', 2)`);
});

afterEach(() => {
  vi.restoreAllMocks();
  state.userId = null;
});

describe('#220 recipe creation refuses an account with a pending deletion', () => {
  it.each(PATHS)('$name: refuses and writes nothing', async (p) => {
    state.userId = PENDING;
    const before = await snapshot();

    expect(await p.run()).toEqual(refusalOf(p));

    expect(await snapshot()).toEqual(before);
  });

  it.each(PATHS)(
    '$name: refuses when the deletion is requested after every read before the insert',
    async (p) => {
      // A guard in a separate query before the statement passes here and the write lands.
      requestDeletionAtRecipeInsert(NORMAL);
      state.userId = NORMAL;
      const before = await snapshot();

      expect(await p.run()).toEqual(refusalOf(p));

      expect(await snapshot()).toEqual(before);
    }
  );

  // A normal user, so the insert runs whatever any pre-check would answer.
  it.each(PATHS)('$name: one recipe insert statement, carrying the guard', async (p) => {
    state.userId = NORMAL;

    const texts = await statementsOf(() => p.run());

    const inserts = texts.filter(insertsRecipe).map((t) => t.replace(/\s+/g, ' '));
    expect(inserts).toHaveLength(1);
    const guard =
      'NOT EXISTS \\(SELECT 1 FROM "users" WHERE "users"\\."id" = \\$\\d+ AND "users"\\."deletion_requested_at" IS NOT NULL\\)';
    expect(inserts[0]).toMatch(
      new RegExp(
        `^ WITH allowed AS \\( SELECT 1 AS ok WHERE ${guard} \\), inserted AS \\( INSERT INTO "recipes" \\([^)]*\\) SELECT .* FROM allowed `
      )
    );
  });
});

describe('#220 recipe creation is unchanged for other accounts', () => {
  it.each(
    PATHS.flatMap((p) => [
      { ...p, who: 'a users row with no pending deletion', userId: NORMAL },
      { ...p, who: 'a legacy id with no users row', userId: LEGACY },
    ])
  )('$name, $who: writes exactly one recipe', async (p) => {
    state.userId = p.userId;
    const before = await rows('SELECT id FROM recipes');

    const outcome = await p.run();

    const added = await rows('SELECT * FROM recipes WHERE NOT (id = ANY($1))', [
      before.map((r) => r.id),
    ]);
    if (p.normal) {
      expect(outcome).toEqual(p.normal);
      expect(added).toEqual([]);
      return;
    }
    expect(outcome).toEqual({ ok: true });
    expect(added).toHaveLength(1);
    expect(added[0].user_id).toBe(p.userId);
  });

  it('createRecipe returns the stored row, with its generated id and slug', async () => {
    state.userId = NORMAL;

    const result = await createRecipe({
      name: 'Leek Soup',
      ingredients: ['1 leek'] as never,
      instructions: '["Simmer"]',
      tags: ['winter'] as never,
      prep_time: '15 minutes' as never,
    });

    expect(result.success).toBe(true);
    const created = (result as { data: typeof schema.recipes.$inferSelect }).data;
    const [stored] = await (state.db as typeof import('@/lib/db').db)
      .select()
      .from(schema.recipes)
      .where(eq(schema.recipes.id, created.id));
    expect(created).toEqual(stored);
    expect(created).toMatchObject({
      user_id: NORMAL,
      slug: 'leek-soup',
      ingredients: '["1 leek"]',
      tags: '["winter"]',
      prep_time: 15,
      license: 'ALL_RIGHTS_RESERVED',
      moderation_status: 'pending',
      is_public: false,
      like_count: 0,
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('cloneRecipe bumps the original fork_count and favorites it once', async () => {
    state.userId = NORMAL;

    const result = await cloneRecipe(ORIGINAL);

    expect(result).toMatchObject({ success: true, clonedRecipe: { user_id: NORMAL } });
    expect(await rows('SELECT fork_count FROM recipes WHERE id = $1', [ORIGINAL])).toEqual([
      { fork_count: 3 },
    ]);
    expect(addFavorite).toHaveBeenCalledTimes(1);
  });

  it('discoverRecipeFromUrl writes the embedding row for the saved recipe', async () => {
    state.userId = NORMAL;

    const result = await discoverRecipeFromUrl('https://example.test/stew');

    const id = (result as { recipe?: { id: string } }).recipe?.id;
    expect(id).toBeDefined();
    expect(await rows('SELECT recipe_id, model_name FROM recipe_embeddings')).toEqual([
      { recipe_id: id, model_name: 'test-embedder' },
    ]);
  });

  it('once the deletion is cancelled the account creates recipes again', async () => {
    await rows('UPDATE users SET deletion_requested_at = NULL WHERE id = $1', [PENDING]);
    state.userId = PENDING;

    expect(
      await createRecipe({ name: 'Back', ingredients: '["a"]', instructions: '["b"]' })
    ).toMatchObject({ success: true });
  });
});

describe('#220 insertUnlessPendingDeletion matches drizzle .values().returning()', () => {
  type Db = {
    insert: (t: unknown) => {
      values: (v: unknown) => { returning: () => Promise<Array<Record<string, unknown>>> };
    };
  };
  const strip = (r: Record<string, unknown> | null) => {
    const { id: _id, created_at: _c, updated_at: _u, slug: _s, ...rest } = r ?? {};
    return rest;
  };

  it('into recipes, with the license enum, text enums, decimals and timestamps', async () => {
    const values = (id: string, slug: string): typeof schema.recipes.$inferInsert => ({
      id,
      slug,
      user_id: NORMAL,
      name: 'Round trip',
      ingredients: '["a"]',
      instructions: '["b"]',
      difficulty: 'medium',
      license: 'CC_BY_SA',
      sweetness_level: 'rich',
      serving_temperature: 'cold',
      moderation_status: 'approved',
      confidence_score: '0.75',
      system_rating: '4.5',
      discovery_date: new Date('2026-01-02T03:04:05.000Z'),
      published_date: new Date('2026-01-03T00:00:00.000Z'),
      qa_status: 'validated',
      instruction_metadata_version: '1.0.0',
      is_meal_prep_friendly: true,
      like_count: 7,
    });

    const [viaDrizzle] = await (state.db as Db)
      .insert(schema.recipes)
      .values(values('eeeeeeee-0000-4000-8000-00000000000e', 'drizzle-slug'))
      .returning();
    const { row: viaGuard } = await insertUnlessPendingDeletion(
      schema.recipes,
      values('ffffffff-0000-4000-8000-00000000000f', 'guard-slug'),
      NORMAL
    );

    expect(viaGuard).not.toBeNull();
    expect(strip(viaGuard)).toEqual(strip(viaDrizzle));
    expect(viaGuard?.license).toBe('CC_BY_SA');
    expect(viaGuard?.discovery_date).toEqual(new Date('2026-01-02T03:04:05.000Z'));
  });

  it('into recipes with only required columns: defaults and $defaultFn id apply alike', async () => {
    const values = { user_id: LEGACY, name: 'Bare', ingredients: '[]', instructions: '[]' };

    const [viaDrizzle] = await (state.db as Db).insert(schema.recipes).values(values).returning();
    const { row: viaGuard } = await insertUnlessPendingDeletion(schema.recipes, values, LEGACY);

    expect(strip(viaGuard)).toEqual(strip(viaDrizzle));
    expect(viaGuard?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(viaGuard?.id).not.toBe(viaDrizzle.id);
  });

  // #220: an enum whose name needs quoting or a schema, and a generated-always column.
  const kitchen = pgSchema('kitchen');
  const course = kitchen.enum('Course', ['Starter', 'Main']);
  const mood = pgEnum('Mood', ['Calm', 'Busy']);
  const probe = pgTable('guard_probe', {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull(),
    course: course('course').notNull(),
    mood: mood('mood'),
    n: integer('n').notNull(),
    doubled: integer('doubled').generatedAlwaysAs(sql`n * 2`),
  });

  it('casts to a quoted, schema-qualified enum and skips a generated column', async () => {
    await client.exec(`
      DROP TABLE IF EXISTS guard_probe; DROP TYPE IF EXISTS "Mood"; DROP SCHEMA IF EXISTS kitchen CASCADE;
      CREATE SCHEMA kitchen; CREATE TYPE kitchen."Course" AS ENUM ('Starter', 'Main');
      CREATE TYPE "Mood" AS ENUM ('Calm', 'Busy');
      CREATE TABLE guard_probe (id text PRIMARY KEY, user_id text NOT NULL,
        course kitchen."Course" NOT NULL, mood "Mood", n integer NOT NULL,
        doubled integer GENERATED ALWAYS AS (n * 2) STORED);`);
    // A spread of a read row carries the generated column; `.values()` drops it.
    const values = (id: string) =>
      ({ id, user_id: NORMAL, course: 'Main', mood: 'Busy', n: 4, doubled: 99 }) as never;

    const [viaDrizzle] = await (state.db as Db).insert(probe).values(values('a')).returning();
    const { row: viaGuard } = await insertUnlessPendingDeletion(probe, values('b'), NORMAL);

    expect(viaGuard).toEqual({ ...viaDrizzle, id: 'b' });
    expect(viaGuard).toMatchObject({ course: 'Main', mood: 'Busy', doubled: 8 });
  });
});
