// @vitest-environment node
/**
 * #59: `flagRecipe` per-user rate limit, through the real limiter and a real
 * `usage_counters` table on PGlite, so the configured limit itself is under test.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const LIMIT = 20;
const REFUSED = { success: false, error: 'Too many reports. Please try again later.' };

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

import { flagRecipe } from '@/app/actions/flag-recipe';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { usageCounters } from '@/lib/db/usage-counters-schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;

const recipeId = (n: number) => `recipe-${n}`;

async function flagCount(userId: string) {
  const { rows } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM recipe_flags WHERE user_id = '${userId}'`
  );
  return rows[0].n;
}

beforeAll(async () => {
  // Fixed clock: a run crossing an hour boundary would otherwise reset the window mid-test.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-01T12:30:00Z'));

  const made = await createVisibilityDb(
    [schema.recipes, schema.recipeFlags, usageCounters, users],
    {
      ...schema,
      usageCounters,
      users,
    }
  );
  client = made.client;
  // Production's constraints that the helper leaves out; the limiter's upsert needs the unique one.
  await client.exec(`
    ALTER TABLE "recipe_flags" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
    CREATE UNIQUE INDEX "usage_counters_key" ON "usage_counters" ("bucket", "key", "window_start");
  `);
  state.db = made.db;

  await made.db.insert(schema.recipes).values(
    Array.from({ length: LIMIT + 1 }, (_, n) => ({
      id: recipeId(n),
      user_id: 'owner',
      name: recipeId(n),
      ingredients: '[]',
      instructions: '[]',
      is_public: true,
      moderation_status: 'approved' as const,
    }))
  );
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(async () => {
  await client.exec(`DELETE FROM "recipe_flags"; DELETE FROM "usage_counters";`);
  state.userId = 'u1';
});

describe('flagRecipe rate limit', () => {
  it('refuses the report past 20 in an hour, stores nothing, and leaves other users alone', async () => {
    for (let n = 0; n < LIMIT; n++) {
      expect((await flagRecipe(recipeId(n), 'spam')).success).toBe(true);
    }

    expect(await flagRecipe(recipeId(LIMIT), 'spam')).toEqual(REFUSED);
    expect(await flagCount('u1')).toBe(LIMIT);

    state.userId = 'u2';
    expect((await flagRecipe(recipeId(LIMIT), 'spam')).success).toBe(true);
  });

  it('allows reports again in the next window', async () => {
    for (let n = 0; n <= LIMIT; n++) await flagRecipe(recipeId(n), 'spam');
    vi.setSystemTime(new Date('2026-11-01T13:00:00Z'));
    try {
      expect((await flagRecipe(recipeId(LIMIT), 'spam')).success).toBe(true);
    } finally {
      vi.setSystemTime(new Date('2026-11-01T12:30:00Z'));
    }
  });

  it('refuses when the limiter cannot count (fail closed)', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await client.exec(`ALTER TABLE "usage_counters" RENAME TO "usage_counters_gone";`);
    try {
      expect(await flagRecipe(recipeId(0), 'spam')).toEqual(REFUSED);
    } finally {
      await client.exec(`ALTER TABLE "usage_counters_gone" RENAME TO "usage_counters";`);
      logged.mockRestore();
    }
    expect(await flagCount('u1')).toBe(0);
  });
});
