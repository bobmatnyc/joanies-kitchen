// @vitest-environment node
/**
 * #270: rating-review reports, auto-hide at three distinct reporters, the admin
 * outcomes, and the public read. Runs the real actions against PGlite with the
 * constraints of migration 0009 (FK cascade, unique (rating_id, user_id), CHECK)
 * and the real rate limiter over a real `usage_counters` table.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN = 'user_admin';
const AUTHOR = 'user_author';
const R1 = 'recipe-1';
const RATING = 'aaaaaaaa-0000-4000-8000-00000000000a';
const REVIEW = 'a mean review';
const LIMIT = 20;
const STALE = {
  success: false,
  error: 'This report was already closed. Refresh the page to see its current state.',
};
const NOT_HIDDEN = {
  success: false,
  error: 'This review is no longer hidden. Refresh the page to see its current state.',
};
const REFUSED = { success: false, error: 'Too many reports. Please try again later.' };

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  userId: null as string | null,
}));

vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => state.userId,
  getSessionUser: async () => (state.userId ? { id: state.userId } : null),
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

import { actOnRecipeFlag, flagRecipe, getAllFlags } from '@/app/actions/flag-recipe';
import { actOnHiddenReview, getHiddenReviews } from '@/app/actions/hidden-reviews';
import {
  deleteRating,
  getRecipeRatings,
  getUserRating,
  rateRecipe,
} from '@/app/actions/rate-recipe';
import { reportRatingReview } from '@/app/actions/report-rating-review';
import { users } from '@/lib/db/auth-schema';
import * as schema from '@/lib/db/schema';
import { usageCounters } from '@/lib/db/usage-counters-schema';
import { userProfiles } from '@/lib/db/user-discovery-schema';
import { createVisibilityDb } from './recipe-visibility-db';

let client: PGlite;
let testDb: Awaited<ReturnType<typeof createVisibilityDb>>['db'];

async function rows(sql: string) {
  return (await client.query(sql)).rows as Record<string, unknown>[];
}

async function rating() {
  return (
    await rows(`SELECT rating, review, review_hidden FROM recipe_ratings WHERE id = '${RATING}'`)
  )[0];
}

async function isHidden() {
  return (await rating())?.review_hidden;
}

async function flagStatuses() {
  const found = await rows(
    `SELECT status FROM recipe_flags WHERE rating_id = '${RATING}' ORDER BY user_id`
  );
  return found.map((r) => r.status);
}

async function reportAs(userId: string) {
  state.userId = userId;
  return reportRatingReview(RATING, 'harassment');
}

async function reportEach(userIds: string[]) {
  for (const u of userIds) await reportAs(u);
}

/** The queue row id of `userId`'s report on the rating. */
async function flagIdOf(userId: string) {
  return (
    await rows(
      `SELECT id FROM recipe_flags WHERE rating_id = '${RATING}' AND user_id = '${userId}'`
    )
  )[0].id as string;
}

async function asAdmin(flagId: string, action: 'dismiss' | 'hide' | 'remove' | 'unhide') {
  state.userId = ADMIN;
  return actOnRecipeFlag(flagId, action);
}

/** Aggregates stored on the recipe: a review report must never change them. */
async function aggregates() {
  return (
    await rows(`SELECT avg_user_rating, total_user_ratings FROM recipes WHERE id = '${R1}'`)
  )[0];
}

beforeAll(async () => {
  // Fixed clock: a run crossing an hour boundary would reset the rate-limit window mid-test.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T12:30:00Z'));

  const made = await createVisibilityDb(
    [
      users,
      schema.recipes,
      schema.recipeRatings,
      schema.recipeFlags,
      schema.recipeComments,
      userProfiles,
      usageCounters,
    ],
    { ...schema, userProfiles, users, usageCounters },
    { constraints: true }
  );
  client = made.client;
  await client.exec(`
    ALTER TABLE "recipe_flags" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
    CREATE UNIQUE INDEX "usage_counters_key" ON "usage_counters" ("bucket", "key", "window_start");
  `);
  // The helper builds columns only; the 0009 constraints come from the shipped migration file.
  const migration = readFileSync(
    path.resolve(process.cwd(), 'drizzle/0009_recipe_rating_review_reports.sql'),
    'utf8'
  );
  for (const statement of migration.split('--> statement-breakpoint').map((s) => s.trim())) {
    if (statement && !/ADD COLUMN/.test(statement)) await client.exec(statement);
  }
  testDb = made.db;
  state.db = made.db;
});

afterAll(async () => {
  vi.useRealTimers();
  await client?.close();
});

beforeEach(async () => {
  await client.exec(
    'DELETE FROM recipe_flags; DELETE FROM recipe_ratings; DELETE FROM recipes; DELETE FROM usage_counters;'
  );
  await testDb.insert(schema.recipes).values({
    id: R1,
    user_id: 'owner',
    name: R1,
    ingredients: '[]',
    instructions: '[]',
    is_public: true,
    moderation_status: 'approved',
    avg_user_rating: '4.0',
    total_user_ratings: 1,
  });
  await testDb.insert(schema.recipeRatings).values({
    id: RATING,
    recipe_id: R1,
    user_id: AUTHOR,
    rating: 4,
    review: REVIEW,
  });
  state.userId = null;
  vi.restoreAllMocks();
});

describe('reportRatingReview', () => {
  it('stores a report in recipe_flags with rating_id', async () => {
    const result = await reportAs('u1');
    expect(result).toEqual({ success: true, hidden: false });
    const [flag] = await rows('SELECT recipe_id, rating_id, comment_id, status FROM recipe_flags');
    expect(flag).toEqual({ recipe_id: R1, rating_id: RATING, comment_id: null, status: 'pending' });
  });

  it('refuses a signed-out caller and stores nothing', async () => {
    state.userId = null;
    const result = await reportRatingReview(RATING, 'spam');
    expect(result.success).toBe(false);
    expect(await rows('SELECT 1 FROM recipe_flags')).toHaveLength(0);
  });

  it('refuses a report on your own review and stores nothing', async () => {
    const result = await reportAs(AUTHOR);
    expect(result).toEqual({ success: false, error: 'You cannot report your own review' });
    expect(await rows('SELECT 1 FROM recipe_flags')).toHaveLength(0);
  });

  it('refuses an unknown reason', async () => {
    state.userId = 'u1';
    const result = await reportRatingReview(RATING, 'nonsense' as never);
    expect(result).toEqual({ success: false, error: 'Invalid flag reason' });
  });

  it('answers a missing, star-only or hidden review as not found', async () => {
    state.userId = 'u1';
    const missing = await reportRatingReview('bbbbbbbb-0000-4000-8000-00000000000b', 'spam');
    expect(missing).toEqual({ success: false, error: 'Review not found' });

    await client.exec(`UPDATE recipe_ratings SET review = NULL WHERE id = '${RATING}'`);
    expect(await reportRatingReview(RATING, 'spam')).toEqual(missing);

    await client.exec(`UPDATE recipe_ratings SET review = 'x', review_hidden = true`);
    expect(await reportRatingReview(RATING, 'spam')).toEqual(missing);
    expect(await rows('SELECT 1 FROM recipe_flags')).toHaveLength(0);
  });

  it('counts a repeat report by one user once and never hides on one user alone', async () => {
    await reportAs('u1');
    expect(await reportAs('u1')).toEqual({ success: true, alreadyReported: true });
    await reportAs('u1');
    expect(await rows('SELECT 1 FROM recipe_flags')).toHaveLength(1);
    expect(await isHidden()).toBe(false);
  });

  it('hides at exactly the third distinct reporter, not the second', async () => {
    expect(await reportAs('u1')).toMatchObject({ hidden: false });
    expect(await reportAs('u2')).toMatchObject({ hidden: false });
    expect(await isHidden()).toBe(false);
    expect(await reportAs('u3')).toEqual({ success: true, hidden: true });
    expect(await isHidden()).toBe(true);
  });

  it('hiding the text leaves the stars and the recipe aggregates unchanged', async () => {
    const before = await aggregates();
    await reportEach(['u1', 'u2', 'u3']);
    expect((await rating()).rating).toBe(4);
    expect(await aggregates()).toEqual(before);
  });

  it('does not block the same user from reporting the recipe itself', async () => {
    await reportAs('u1');
    expect((await flagRecipe(R1, 'spam')).success).toBe(true);
    expect((await flagRecipe(R1, 'spam')).success).toBe(false); // the recipe's own once-per-user rule
  });
});

describe('reportRatingReview rate limit', () => {
  async function ratingsFrom(n: number) {
    // One more rating than the limit, so a single reporter has something to report each time.
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = `cccccccc-0000-4000-8000-${String(i).padStart(12, '0')}`;
      ids.push(id);
      await testDb.insert(schema.recipeRatings).values({
        id,
        recipe_id: R1,
        user_id: `author-${i}`,
        rating: 3,
        review: `review ${i}`,
      });
    }
    return ids;
  }

  it('refuses past 20 an hour on its own bucket, stores nothing more, and spares other users', async () => {
    const ids = await ratingsFrom(LIMIT + 1);
    state.userId = 'u1';
    for (const id of ids.slice(0, LIMIT)) {
      expect((await reportRatingReview(id, 'spam')).success).toBe(true);
    }
    expect(await reportRatingReview(ids[LIMIT], 'spam')).toEqual(REFUSED);
    expect(await rows(`SELECT 1 FROM recipe_flags WHERE user_id = 'u1'`)).toHaveLength(LIMIT);

    const buckets = await rows('SELECT DISTINCT bucket FROM usage_counters');
    expect(buckets).toEqual([{ bucket: 'rl:review-report' }]);

    state.userId = 'u2';
    expect((await reportRatingReview(ids[LIMIT], 'spam')).success).toBe(true);
  });

  it('refuses when the limiter cannot count (fail closed)', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await client.exec('ALTER TABLE "usage_counters" RENAME TO "usage_counters_gone";');
    try {
      expect(await reportAs('u1')).toEqual(REFUSED);
      expect(await rows('SELECT 1 FROM recipe_flags')).toHaveLength(0);
    } finally {
      await client.exec('ALTER TABLE "usage_counters_gone" RENAME TO "usage_counters";');
      logged.mockRestore();
    }
  });
});

describe('public read of a hidden review', () => {
  async function ratingsAs(viewer: string | null) {
    state.userId = viewer;
    return getRecipeRatings(R1);
  }

  it('shows review: null with the stars unchanged, and flags the author only', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    const other = (await ratingsAs('u1'))[0];
    expect(other).toMatchObject({ rating: 4, review: null, reviewHidden: false });
    const signedOut = (await ratingsAs(null))[0];
    expect(signedOut).toMatchObject({ rating: 4, review: null, reviewHidden: false });
    const author = (await ratingsAs(AUTHOR))[0];
    expect(author).toMatchObject({ rating: 4, review: null, reviewHidden: true });
    // The stored aggregates were never touched.
    expect(await aggregates()).toEqual({ avg_user_rating: '4.0', total_user_ratings: 1 });
  });

  it('shows the text while the review is not hidden', async () => {
    expect((await ratingsAs('u1'))[0]).toMatchObject({ review: REVIEW, reviewHidden: false });
  });

  it('an author who edits a hidden review keeps it hidden', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    state.userId = AUTHOR;
    const edited = await rateRecipe(R1, 5, 'a kinder review');
    expect(edited).toMatchObject({ success: true });
    expect(await rating()).toMatchObject({
      rating: 5,
      review: 'a kinder review',
      review_hidden: true,
    });
    expect((await ratingsAs('u1'))[0]).toMatchObject({ rating: 5, review: null });
    state.userId = AUTHOR;
    expect(await getUserRating(R1)).toMatchObject({ rating: 5, reviewHidden: true });
  });
});

describe('moderation queue for review reports', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('lists a review report with its text and hidden state', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    state.userId = ADMIN;
    const flags = await getAllFlags('pending');
    expect(flags).toHaveLength(3);
    expect(flags[0]).toMatchObject({
      rating_id: RATING,
      comment_id: null,
      reviewContent: REVIEW,
      reviewHidden: true,
    });
  });

  it('refuses a non-admin', async () => {
    await reportAs('u1');
    state.userId = 'u1';
    const result = await actOnRecipeFlag(await flagIdOf('u1'), 'hide');
    expect(result.success).toBe(false);
    expect(await isHidden()).toBe(false);
  });

  it('dismiss closes one report and never unhides', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    expect(await isHidden()).toBe(true);
    expect(await asAdmin(await flagIdOf('u1'), 'dismiss')).toEqual({ success: true });
    expect(await isHidden()).toBe(true);
    expect(await flagStatuses()).toEqual(['dismissed', 'pending', 'pending']);
    // Even with no pending report left, the review stays hidden until an explicit unhide.
    await asAdmin(await flagIdOf('u2'), 'dismiss');
    await asAdmin(await flagIdOf('u3'), 'dismiss');
    expect(await isHidden()).toBe(true);
  });

  it('dismiss keeps a review an admin hid from the queue hidden', async () => {
    await reportEach(['u1']);
    await asAdmin(await flagIdOf('u1'), 'hide');
    expect(await isHidden()).toBe(true);
    // A stale page dismissing the now-resolved report writes nothing.
    expect(await asAdmin(await flagIdOf('u1'), 'dismiss')).toEqual(STALE);
    expect(await isHidden()).toBe(true);
  });

  it('hide hides the text and resolves every pending report', async () => {
    await reportEach(['u1', 'u2']);
    expect(await asAdmin(await flagIdOf('u1'), 'hide')).toEqual({ success: true });
    expect(await isHidden()).toBe(true);
    expect(await flagStatuses()).toEqual(['resolved', 'resolved']);
  });

  it('remove clears the text, keeps the rating and the aggregates, and resolves the reports', async () => {
    const before = await aggregates();
    await reportEach(['u1', 'u2', 'u3']);
    expect(await asAdmin(await flagIdOf('u1'), 'remove')).toEqual({ success: true });
    expect(await rating()).toEqual({ rating: 4, review: null, review_hidden: false });
    expect(await aggregates()).toEqual(before);
    expect(await flagStatuses()).toEqual(['resolved', 'resolved', 'resolved']);
    state.userId = 'u9';
    expect((await getRecipeRatings(R1))[0]).toMatchObject({ rating: 4, review: null });
  });

  it('unhide restores the text, dismisses pending reports, and one old reporter cannot re-hide', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    expect(await asAdmin(await flagIdOf('u1'), 'unhide')).toEqual({ success: true });
    expect(await isHidden()).toBe(false);
    expect(await flagStatuses()).toEqual(['dismissed', 'dismissed', 'dismissed']);
    // The earlier reporters' rows span every status, so they cannot count again.
    expect(await reportAs('u1')).toEqual({ success: true, alreadyReported: true });
    expect(await reportAs('u4')).toMatchObject({ hidden: false });
    expect(await isHidden()).toBe(false);
  });

  it('a stale hide or remove on a closed report writes nothing', async () => {
    await reportEach(['u1', 'u2']);
    const closed = await flagIdOf('u1');
    await asAdmin(closed, 'dismiss');
    await client.exec(`UPDATE recipe_ratings SET review = 'fresh text' WHERE id = '${RATING}'`);
    expect(await asAdmin(closed, 'hide')).toEqual(STALE);
    expect(await asAdmin(closed, 'remove')).toEqual(STALE);
    expect(await rating()).toMatchObject({ review: 'fresh text', review_hidden: false });
    // The other pending report stays open.
    expect(await flagStatuses()).toEqual(['dismissed', 'pending']);
  });

  it('unhide of a visible review is stale and writes nothing', async () => {
    await reportEach(['u1']);
    expect(await asAdmin(await flagIdOf('u1'), 'unhide')).toEqual(NOT_HIDDEN);
    expect(await flagStatuses()).toEqual(['pending']);
  });

  it('a review report never touches the recipe', async () => {
    await reportEach(['u1']);
    await asAdmin(await flagIdOf('u1'), 'remove');
    const [recipe] = await rows(
      `SELECT moderation_status, deleted_at FROM recipes WHERE id = '${R1}'`
    );
    expect(recipe).toEqual({ moderation_status: 'approved', deleted_at: null });
  });
});

describe('hidden reviews panel actions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('lists every hidden review with its pending-report count; refuses a non-admin', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    state.userId = 'u1';
    await expect(getHiddenReviews()).rejects.toThrow();
    state.userId = ADMIN;
    const page = await getHiddenReviews(1);
    expect(page.total).toBe(1);
    expect(page.reviews[0]).toMatchObject({
      id: RATING,
      recipeName: R1,
      review: REVIEW,
      rating: 4,
      pendingReports: 3,
    });
  });

  it('unhide shows the text again and dismisses its pending reports', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    state.userId = ADMIN;
    expect(await actOnHiddenReview(RATING, 'unhide', 'looks fine')).toEqual({ success: true });
    expect(await isHidden()).toBe(false);
    expect(await flagStatuses()).toEqual(['dismissed', 'dismissed', 'dismissed']);
  });

  it('remove clears the text, keeps the rating, and a repeat acts on a visible review', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    state.userId = ADMIN;
    expect(await actOnHiddenReview(RATING, 'remove')).toEqual({ success: true });
    expect(await rating()).toEqual({ rating: 4, review: null, review_hidden: false });
    expect(await actOnHiddenReview(RATING, 'remove')).toEqual(NOT_HIDDEN);
    expect(await actOnHiddenReview(RATING, 'unhide')).toEqual(NOT_HIDDEN);
  });
});

describe('deleting a rating', () => {
  it('deletes its reports and leaves other reports alone', async () => {
    await reportEach(['u1', 'u2']);
    await client.exec(
      `INSERT INTO recipe_flags (recipe_id, user_id, reason) VALUES ('${R1}', 'u1', 'spam')`
    );
    state.userId = AUTHOR;
    expect(await deleteRating(R1)).toEqual({ success: true });
    expect(await rows(`SELECT 1 FROM recipe_ratings WHERE id = '${RATING}'`)).toHaveLength(0);
    expect(await rows(`SELECT 1 FROM recipe_flags WHERE rating_id IS NOT NULL`)).toHaveLength(0);
    expect(await rows('SELECT 1 FROM recipe_flags')).toHaveLength(1); // the recipe report stays
  });
});

// #283: the owner's report policy for an edit, a delete-and-repost, and a re-report.
describe('#283 report policy', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  /** Every review-report row, as (rating_id, user_id, status). */
  async function reviewReports() {
    return rows(
      'SELECT rating_id, user_id, status FROM recipe_flags WHERE rating_id IS NOT NULL ORDER BY user_id'
    );
  }

  it('an edit keeps every report, pending and closed, and pending ones still count', async () => {
    await reportEach(['u1', 'u2']);
    await asAdmin(await flagIdOf('u1'), 'dismiss');
    state.userId = AUTHOR;
    expect(await rateRecipe(R1, 2, 'an edited review')).toMatchObject({ success: true });
    expect(await reviewReports()).toEqual([
      { rating_id: RATING, user_id: 'u1', status: 'dismissed' },
      { rating_id: RATING, user_id: 'u2', status: 'pending' },
    ]);
    // u2's pending report survived the edit, so two more reporters make three pending.
    expect(await reportAs('u3')).toMatchObject({ hidden: false });
    expect(await reportAs('u4')).toEqual({ success: true, hidden: true });
  });

  it('an edit of a hidden review keeps its reports and its hidden state', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    state.userId = AUTHOR;
    expect(await rateRecipe(R1, 5, 'a kinder review')).toMatchObject({ success: true });
    expect(await flagStatuses()).toEqual(['pending', 'pending', 'pending']);
    expect(await isHidden()).toBe(true);
  });

  it('delete then repost starts visible with no reports carried over', async () => {
    await reportEach(['u1', 'u2', 'u3']);
    expect(await isHidden()).toBe(true);
    state.userId = AUTHOR;
    expect(await deleteRating(R1)).toEqual({ success: true });
    expect(await rateRecipe(R1, 3, 'a fresh review')).toMatchObject({ success: true });

    const [fresh] = await rows(
      `SELECT id, review, review_hidden FROM recipe_ratings WHERE recipe_id = '${R1}' AND user_id = '${AUTHOR}'`
    );
    expect(fresh).toMatchObject({ review: 'a fresh review', review_hidden: false });
    expect(fresh.id).not.toBe(RATING);
    expect(await reviewReports()).toEqual([]);
    state.userId = 'u9';
    expect((await getRecipeRatings(R1))[0]).toMatchObject({ review: 'a fresh review' });

    // The new review counts its reporters from zero: two reports do not hide it.
    for (const u of ['u1', 'u2']) {
      state.userId = u;
      expect(await reportRatingReview(fresh.id as string, 'spam')).toEqual({
        success: true,
        hidden: false,
      });
    }
  });

  it('a re-report after dismissal is refused and does not reopen the report', async () => {
    await reportAs('u1');
    await asAdmin(await flagIdOf('u1'), 'dismiss');
    expect(await reportAs('u1')).toEqual({ success: true, alreadyReported: true });
    expect(await reviewReports()).toEqual([
      { rating_id: RATING, user_id: 'u1', status: 'dismissed' },
    ]);
  });

  it('a re-report of the same review after an edit is refused', async () => {
    await reportAs('u1');
    state.userId = AUTHOR;
    expect(await rateRecipe(R1, 4, 'reworded review')).toMatchObject({ success: true });
    expect(await reportAs('u1')).toEqual({ success: true, alreadyReported: true });
    expect(await reviewReports()).toEqual([
      { rating_id: RATING, user_id: 'u1', status: 'pending' },
    ]);
  });

  it('a re-report after dismissal and then an edit is refused', async () => {
    await reportAs('u1');
    await asAdmin(await flagIdOf('u1'), 'dismiss');
    state.userId = AUTHOR;
    expect(await rateRecipe(R1, 4, 'reworded review')).toMatchObject({ success: true });
    expect(await reportAs('u1')).toEqual({ success: true, alreadyReported: true });
    expect(await reviewReports()).toEqual([
      { rating_id: RATING, user_id: 'u1', status: 'dismissed' },
    ]);
  });
});
