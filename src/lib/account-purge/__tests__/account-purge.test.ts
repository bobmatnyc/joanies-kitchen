// @vitest-environment node
/**
 * #104 (D7c S5): the purge of accounts past their 30-day grace period.
 *
 * Runs the real S4 request (`markAccountDeleted`) and the real purge against
 * PGlite seeded by the export fixture (one row per user-owned table per user).
 * `db.batch` is shimmed as one BEGIN/COMMIT transaction, which is what
 * neon-http sends; `@vercel/blob` `del` is a mock.
 */

import type { PGlite } from '@electric-sql/pglite';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown, del: vi.fn() }));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@vercel/blob', () => ({ del: state.del }));

import { DELETION_GRACE_PERIOD_MS, markAccountDeleted } from '@/lib/account-deletion';
import { seedExportDb } from '@/lib/account-export/__tests__/export-fixture';
import { allSchemaTables } from '@/lib/account-export/__tests__/schema-modules';
import { DELETED_USER_ID, PURGE_COLUMN_PLAN, purgeDueAccounts } from '@/lib/account-purge';
import { purgeStatements } from '@/lib/account-purge/statements';
import { apiKeyUsage } from '@/lib/db/api-keys-schema';
import { verificationTokens } from '@/lib/db/auth-schema';
import { recipeDiscoveryRunItems, recipeOfTheDay } from '@/lib/db/autonomous-scraper-schema';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { joanieComments } from '@/lib/db/schema';

const NOW = new Date('2026-10-29T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const BLOB = 'https://store1.public.blob.vercel-storage.com';
const OWN_BLOB = `${BLOB}/a-own.jpg`;
const PRIVATE_BLOB = `${BLOB}/a-private.jpg`;
const SHARED_BLOB = `${BLOB}/shared-with-fork.jpg`;
const B_COMMENT = 'dddddddd-0000-4000-8000-00000000000d';

let fx: Awaited<ReturnType<typeof seedExportDb>>;
let client: PGlite;
let recipeA: string;
let recipeB: string;

async function rows(query: string, params: unknown[] = []) {
  return (await client.query(query, params)).rows as Record<string, unknown>[];
}

/** Every row of every table, as one string, to check which ids survive. */
async function dump(): Promise<string> {
  const tables = await rows(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const out: unknown[] = [];
  for (const { table_name } of tables) out.push(await rows(`SELECT * FROM "${table_name}"`));
  return JSON.stringify(out);
}

/** The real S4 request, made `daysAgo` days before NOW. */
async function requestDeletion(userId: string, keepRecipes: boolean, daysAgo: number) {
  await markAccountDeleted(userId, keepRecipes, new Date(NOW.getTime() - daysAgo * DAY));
}

async function userExists(userId: string): Promise<boolean> {
  return (await rows('SELECT 1 FROM users WHERE id = $1', [userId])).length === 1;
}

async function addUser(id: string, extra: Record<string, unknown> = {}) {
  await rows(`INSERT INTO users (id, email, is_admin) VALUES ($1, $2, $3)`, [
    id,
    `${id}@example.test`,
    extra.is_admin === true,
  ]);
}

beforeEach(async () => {
  fx = await seedExportDb([
    chefs, // #174: the purge recounts chefs linked to the deleted recipes
    chefRecipes,
    joanieComments,
    recipeOfTheDay,
    recipeDiscoveryRunItems,
    apiKeyUsage,
    verificationTokens,
  ]);
  client = fx.client;
  // recipe_embeddings has a pgvector column PGlite lacks; the purge only needs recipe_id.
  await client.exec('CREATE TABLE recipe_embeddings (id uuid, recipe_id text);');
  // The fixture builds tables without defaults; prod has is_admin NOT NULL DEFAULT false.
  await client.exec('UPDATE users SET is_admin = false;');
  const db = fx.db as typeof fx.db & { batch?: unknown };
  // neon-http's db.batch is one HTTP transaction; mirror that on PGlite.
  db.batch = async (queries: PromiseLike<unknown>[]) => {
    await client.exec('BEGIN');
    try {
      const out: unknown[] = [];
      for (const q of queries) out.push(await q);
      await client.exec('COMMIT');
      return out;
    } catch (error) {
      await client.exec('ROLLBACK');
      throw error;
    }
  };
  state.db = db;
  state.del.mockReset();
  state.del.mockResolvedValue(undefined);
  vi.stubEnv('AUTH_ADMIN_EMAILS', '');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  [{ id: recipeA }] = (await rows('SELECT id FROM recipes WHERE user_id = $1', [fx.userA])) as {
    id: string;
  }[];
  [{ id: recipeB }] = (await rows('SELECT id FROM recipes WHERE user_id = $1', [fx.userB])) as {
    id: string;
  }[];
  // A: a public recipe with an own blob and a blob B's fork copied, plus a private recipe.
  await rows('UPDATE recipes SET image_url = $1, images = $2 WHERE id = $3', [
    OWN_BLOB,
    JSON.stringify([SHARED_BLOB, 'https://example.com/external.jpg']),
    recipeA,
  ]);
  await rows(
    `INSERT INTO recipes (id, user_id, name, is_public, images) VALUES ('a-private', $1, 'P', false, $2)`,
    [fx.userA, JSON.stringify([PRIVATE_BLOB])]
  );
  // B forked A's recipe; the fork carries the same Blob URL.
  await rows('UPDATE recipes SET image_url = $1 WHERE id = $2', [SHARED_BLOB, recipeB]);
  await rows(
    `INSERT INTO recipe_forks (id, recipe_id, original_recipe_id, user_id) VALUES (gen_random_uuid(), $1, $2, $3)`,
    [recipeB, recipeA, fx.userB]
  );
  // B commented on A's recipe.
  await rows(
    `INSERT INTO recipe_comments (id, recipe_id, user_id, content) VALUES ($1, $2, $3, 'yum')`,
    [B_COMMENT, recipeA, fx.userB]
  );
  for (const [table, col] of [
    ['recipe_embeddings', 'recipe_id'],
    ['chef_recipes', 'recipe_id'],
    ['joanie_comments', 'recipe_id'],
    ['recipe_of_the_day', 'recipe_id'],
  ]) {
    await rows(`INSERT INTO "${table}" ("${col}") VALUES ($1)`, [recipeA]);
  }
  await rows(`INSERT INTO verification_tokens (identifier, token) VALUES ('a@example.com', 't')`);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await client.close();
});

function deletedBlobs(): string[] {
  return state.del.mock.calls.flatMap(([urls]) => urls as string[]);
}

describe('purgeDueAccounts', () => {
  it('purges a due account everywhere, deleting only blobs no one else uses', async () => {
    await requestDeletion(fx.userA, false, 31);

    const result = await purgeDueAccounts(NOW);

    expect(result).toEqual({ purged: [fx.userA], failed: [], skipped: [] });
    expect(await userExists(fx.userA)).toBe(false);
    const text = await dump();
    for (const id of fx.aIds) expect(text, id).not.toContain(id);
    expect(text).not.toContain('a-private');
    expect(text).not.toContain('a@example.com');
    for (const id of fx.bIds) expect(text, id).toContain(id);
    expect(await rows('SELECT 1 FROM recipe_comments WHERE id = $1', [B_COMMENT])).toEqual([]);
    // A's system template stays, no longer naming A.
    const [tpl] = await rows('SELECT created_by FROM meal_templates WHERE id = $1', [
      fx.systemTemplateId,
    ]);
    expect(tpl.created_by).toBe(DELETED_USER_ID);
    expect(deletedBlobs().sort()).toEqual([OWN_BLOB, PRIVATE_BLOB].sort());
    expect(await rows('SELECT image_url FROM recipes WHERE id = $1', [recipeB])).toEqual([
      { image_url: SHARED_BLOB },
    ]);
  });

  it('keeps public recipes as deleted-user, with others’ comments and their blobs', async () => {
    await requestDeletion(fx.userA, true, 31);

    const result = await purgeDueAccounts(NOW);

    expect(result.purged).toEqual([fx.userA]);
    expect(await userExists(fx.userA)).toBe(false);
    expect(
      await rows('SELECT user_id, deleted_at, deleted_by FROM recipes WHERE id = $1', [recipeA])
    ).toEqual([{ user_id: DELETED_USER_ID, deleted_at: null, deleted_by: null }]);
    expect(await rows(`SELECT 1 FROM recipes WHERE id = 'a-private'`)).toEqual([]);
    expect(
      await rows(`SELECT user_id FROM recipe_comments WHERE recipe_id = $1`, [recipeA])
    ).toEqual([{ user_id: fx.userB }]);
    expect(
      await rows(`SELECT 1 FROM recipe_ingredients WHERE recipe_id = $1`, [recipeA])
    ).toHaveLength(1);
    expect(deletedBlobs()).toEqual([PRIVATE_BLOB]);
    expect(await dump()).not.toContain(fx.userA);
  });

  it('#167 (D26): recounts like_count for recipes the purged user favorited', async () => {
    // A and B both favorited B's recipe (B's row comes from the fixture); like_count says 2.
    await rows(
      `INSERT INTO favorites (id, user_id, recipe_id) VALUES (gen_random_uuid(), $1, $2)`,
      [fx.userA, recipeB]
    );
    await rows('UPDATE recipes SET like_count = 2 WHERE id = $1', [recipeB]);
    await requestDeletion(fx.userA, false, 31);

    const result = await purgeDueAccounts(NOW);

    expect(result.purged).toEqual([fx.userA]);
    expect(await rows('SELECT like_count FROM recipes WHERE id = $1', [recipeB])).toEqual([
      { like_count: 1 },
    ]);
  });

  it.each([
    [false, 1],
    [true, 2],
  ])(
    '#174: recounts chefs linked to the deleted recipes (keepRecipes=%s)',
    async (keep, expected) => {
      // A chef linked to A's public recipe (kept under "keep"), A's private recipe, and B's recipe.
      const chef = 'cccccccc-0000-4000-8000-00000000000c';
      await rows(`INSERT INTO chefs (id, slug, name, recipe_count) VALUES ($1, 'c', 'C', 3)`, [
        chef,
      ]);
      await rows(
        `INSERT INTO chef_recipes (id, chef_id, recipe_id) VALUES
        (gen_random_uuid(), $1, $2), (gen_random_uuid(), $1, 'a-private'), (gen_random_uuid(), $1, $3)`,
        [chef, recipeA, recipeB]
      );
      await requestDeletion(fx.userA, keep, 31);

      const result = await purgeDueAccounts(NOW);

      expect(result.purged).toEqual([fx.userA]);
      const [live] = await rows('SELECT count(*)::int AS n FROM chef_recipes WHERE chef_id = $1', [
        chef,
      ]);
      expect(live.n).toBe(expected);
      expect(await rows('SELECT recipe_count FROM chefs WHERE id = $1', [chef])).toEqual([
        { recipe_count: expected },
      ]);
    }
  );

  it('leaves a day-29 account and an admin untouched', async () => {
    await requestDeletion(fx.userA, false, 29);
    await addUser('admin-1', { is_admin: true });
    await rows('UPDATE users SET deletion_requested_at = $1 WHERE id = $2', [
      new Date(NOW.getTime() - 40 * DAY),
      'admin-1',
    ]);
    await addUser('env-admin');
    await requestDeletion('env-admin', false, 40);
    vi.stubEnv('AUTH_ADMIN_EMAILS', 'env-admin@example.test');
    const before = await dump();

    const result = await purgeDueAccounts(NOW);

    expect(result).toEqual({ purged: [], failed: [], skipped: ['env-admin'] });
    expect(await dump()).toBe(before);
    expect(state.del).not.toHaveBeenCalled();
    // The boundary: exactly 30 days is due.
    expect(DELETION_GRACE_PERIOD_MS).toBe(30 * DAY);
  });

  it('keeps the users row and moves on when a dependent step fails', async () => {
    await requestDeletion(fx.userA, false, 31);
    await addUser('user-c');
    await requestDeletion('user-c', false, 35);
    // A's batch fails on a step after most deletes; C (older, purged first) has no waste rows.
    await client.exec(`CREATE FUNCTION fail_for_a() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'waste_tracking unavailable'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_a BEFORE DELETE ON waste_tracking FOR EACH ROW EXECUTE FUNCTION fail_for_a();`);

    const result = await purgeDueAccounts(NOW);

    expect(result.purged).toEqual(['user-c']);
    expect(result.failed).toEqual([
      { userId: fx.userA, error: expect.stringContaining('waste_tracking unavailable') },
    ]);
    expect(await userExists(fx.userA)).toBe(true);
    expect(await userExists('user-c')).toBe(false);
    // The batch rolled back: A's recipes and profile are all still there.
    expect(await rows('SELECT 1 FROM recipes WHERE user_id = $1', [fx.userA])).toHaveLength(2);
    expect(await rows('SELECT 1 FROM user_profiles WHERE user_id = $1', [fx.userA])).toHaveLength(
      1
    );
    expect(console.error).toHaveBeenCalled();
  });

  it('keeps the users row and every DB row when blob deletion fails', async () => {
    await requestDeletion(fx.userA, false, 31);
    state.del.mockRejectedValueOnce(new Error('blob store down'));

    const result = await purgeDueAccounts(NOW);

    expect(result.failed).toEqual([{ userId: fx.userA, error: 'blob store down' }]);
    expect(result.purged).toEqual([]);
    expect(await userExists(fx.userA)).toBe(true);
    expect(await rows('SELECT 1 FROM recipes WHERE user_id = $1', [fx.userA])).toHaveLength(2);
  });

  it('completes on a re-run after a partial failure, with no duplicate effects', async () => {
    await requestDeletion(fx.userA, true, 31);
    // Run 1: blobs are deleted, then the DB batch fails (a crash between steps).
    await client.exec(`CREATE FUNCTION fail_once() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'connection reset'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_once BEFORE DELETE ON api_keys FOR EACH ROW EXECUTE FUNCTION fail_once();`);
    const first = await purgeDueAccounts(NOW);
    expect(first.failed).toHaveLength(1);
    expect(await userExists(fx.userA)).toBe(true);
    expect(await rows('SELECT user_id FROM recipes WHERE id = $1', [recipeA])).toEqual([
      { user_id: fx.userA },
    ]);

    await client.exec('DROP TRIGGER fail_once ON api_keys;');
    const second = await purgeDueAccounts(NOW);
    const third = await purgeDueAccounts(NOW);

    expect(second).toEqual({ purged: [fx.userA], failed: [], skipped: [] });
    expect(third).toEqual({ purged: [], failed: [], skipped: [] });
    expect(await userExists(fx.userA)).toBe(false);
    expect(await rows('SELECT id FROM recipes WHERE user_id = $1', [DELETED_USER_ID])).toEqual([
      { id: recipeA },
    ]);
    // The same blob is requested again on the re-run; Vercel's del is a no-op for a missing blob.
    expect(deletedBlobs()).toEqual([PRIVATE_BLOB, PRIVATE_BLOB]);
    expect(await dump()).not.toContain(fx.userA);
  });
});

// #158: PGlite is one session, so it cannot interleave the purge with a rating.
// This pins the issued order instead: rateRecipe/deleteRating lock the recipe row
// before writing recipe_ratings, so the purge must lock its recipes rows first too.
describe('#158 purge locks recipes rows before deleting ratings', () => {
  const LOCK = /^select .+ from "recipes" where .+ order by "recipes"\."id" asc for update$/;
  function purgeSql() {
    const t = { userId: fx.userA, email: null, keepRecipes: true, cutoff: NOW };
    return purgeStatements(t).map((q) => q.toSQL().sql);
  }

  it('takes one id-ordered FOR UPDATE lock before every recipe_ratings and recipes write', () => {
    const sqls = purgeSql();
    const lock = sqls.findIndex((s) => LOCK.test(s));
    const ratingDeletes = sqls.flatMap((s, i) =>
      /^delete from "recipe_ratings"/.test(s) ? [i] : []
    );
    const recipeWrites = sqls.flatMap((s, i) =>
      /^(update|delete from) "recipes"/.test(s) ? [i] : []
    );

    expect(lock).toBeGreaterThan(-1);
    expect(ratingDeletes).toHaveLength(2);
    expect(recipeWrites.length).toBeGreaterThan(0);
    for (const i of [...ratingDeletes, ...recipeWrites]) expect(i).toBeGreaterThan(lock);
  });

  it('locks the own recipes, every recipe naming the user as an actor or favorited by them, and no other', async () => {
    await rows(
      `INSERT INTO recipes (id, user_id, name, deleted_by) VALUES ('c-del', $1, 'D', $2)`,
      [fx.userB, fx.userA]
    );
    await rows(
      `INSERT INTO recipes (id, user_id, name, moderated_by) VALUES ('c-mod', $1, 'M', $2)`,
      [fx.userB, fx.userA]
    );
    await rows(
      `INSERT INTO recipes (id, user_id, name, image_regeneration_requested_by) VALUES ('c-img', $1, 'I', $2)`,
      [fx.userB, fx.userA]
    );
    // #167 (D26): the like_count recount writes recipes the user favorited.
    await rows(`INSERT INTO recipes (id, user_id, name) VALUES ('c-fav', $1, 'F')`, [fx.userB]);
    await rows(
      `INSERT INTO favorites (id, user_id, recipe_id) VALUES (gen_random_uuid(), $1, 'c-fav')`,
      [fx.userA]
    );
    const t = { userId: fx.userA, email: null, keepRecipes: true, cutoff: NOW };
    const lock = purgeStatements(t).find((q) => LOCK.test(q.toSQL().sql));
    expect(lock).toBeDefined();

    const locked = ((await lock) as { id: string }[]).map((r) => r.id);

    expect([...locked].sort()).toEqual(
      [recipeA, 'a-private', 'c-del', 'c-mod', 'c-img', 'c-fav'].sort()
    );
    expect(locked).not.toContain(recipeB);
  });
});

describe('purge column inventory', () => {
  const REFERENCE = /^(user_id|recipe_id|original_recipe_id)$|_by$/;

  it('names a handling for every user and recipe reference column in the schema', () => {
    // A Set: some tables are re-exported by more than one schema module.
    const found = [
      ...new Set(
        allSchemaTables().flatMap((table) => {
          const config = getTableConfig(table);
          return config.columns
            .filter((c) => REFERENCE.test(c.name))
            .map((c) => `${config.name}.${c.name}`);
        })
      ),
    ];
    expect(found.length).toBeGreaterThan(30);
    expect(found.filter((key) => !(key in PURGE_COLUMN_PLAN))).toEqual([]);
    expect(Object.keys(PURGE_COLUMN_PLAN).filter((key) => !found.includes(key))).toEqual([]);
  });
});
