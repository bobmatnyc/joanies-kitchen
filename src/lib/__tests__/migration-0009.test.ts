// @vitest-environment node
/**
 * #270: migration 0009 (rating-review reports) applied to a PGlite database that has
 * every earlier migration (0000-0008) run in order, the state production is in.
 * Asserts it applies cleanly over existing rows, adds only what it should, and that
 * its CHECK, unique index and FK cascade enforce the rules the actions rely on.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DIR = path.resolve(process.cwd(), 'drizzle');

function migration(prefix: string): string[] {
  const file = readdirSync(DIR).find((f) => f.startsWith(prefix) && f.endsWith('.sql'));
  if (!file) throw new Error(`no migration ${prefix}`);
  // Split as the drizzle migrator does.
  return readFileSync(path.join(DIR, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The installed PGlite ships no pgvector, so the statements that need it (the
 * extension, the `vector` column and the HNSW index, all on `recipe_embeddings`)
 * are skipped. 0009 touches only `recipe_ratings` and `recipe_flags`.
 */
const NEEDS_PGVECTOR = /vector|hnsw|recipe_embeddings/i;

async function apply(client: PGlite, prefix: string): Promise<void> {
  await client.exec('BEGIN');
  try {
    for (const statement of migration(prefix)) {
      if (NEEDS_PGVECTOR.test(statement)) continue;
      await client.exec(statement);
    }
    await client.exec('COMMIT');
  } catch (error) {
    await client.exec('ROLLBACK');
    throw error;
  }
}

let client: PGlite;

const R = 'recipe-0009';
const RATING = '11111111-1111-4111-8111-111111111111';
const RATING_2 = '22222222-2222-4222-8222-222222222222';
const COMMENT = '33333333-3333-4333-8333-333333333333';

/** A report by `u1` on `column` = `id`. */
function flag(column: 'rating_id' | 'comment_id', id: string): string {
  return `INSERT INTO recipe_flags (recipe_id, user_id, reason, ${column}) VALUES ('${R}', 'u1', 'spam', '${id}')`;
}

beforeAll(async () => {
  client = new PGlite({ extensions: { pg_trgm } });
  for (let n = 0; n <= 8; n++) await apply(client, `000${n}_`);
  // Rows that exist before 0009: a recipe, a rating, a recipe report and a comment report.
  await client.exec(`
    INSERT INTO recipes (id, user_id, name, ingredients, instructions) VALUES ('${R}', 'owner', 'r', '[]', '[]');
    INSERT INTO recipe_ratings (id, recipe_id, user_id, rating, review) VALUES ('${RATING}', '${R}', 'author', 4, 'text');
    INSERT INTO recipe_flags (recipe_id, user_id, reason) VALUES ('${R}', 'pre-recipe', 'spam');
    INSERT INTO recipe_flags (recipe_id, user_id, reason, comment_id) VALUES ('${R}', 'pre-comment', 'spam', '${COMMENT}');
  `);
  await apply(client, '0009_');
}, 60_000);

afterAll(async () => {
  await client?.close();
});

describe('migration 0009 over a database at 0008', () => {
  it('keeps every existing row and defaults the new columns', async () => {
    const flags = await client.query<{ rating_id: string | null }>(
      'SELECT rating_id FROM recipe_flags'
    );
    expect(flags.rows).toHaveLength(2);
    expect(flags.rows.every((r) => r.rating_id === null)).toBe(true);
    const rating = await client.query<{ review: string; review_hidden: boolean }>(
      `SELECT review, review_hidden FROM recipe_ratings WHERE id = '${RATING}'`
    );
    expect(rating.rows[0]).toEqual({ review: 'text', review_hidden: false });
  });

  it('accepts a rating report, a comment report and a recipe report', async () => {
    await client.exec(flag('rating_id', RATING));
    await client.exec(flag('comment_id', COMMENT));
    await client.exec(
      `INSERT INTO recipe_flags (recipe_id, user_id, reason) VALUES ('${R}', 'u9', 'spam')`
    );
  });

  it('CHECK refuses a report that targets a comment and a rating at once', async () => {
    await expect(
      client.exec(
        `INSERT INTO recipe_flags (recipe_id, user_id, reason, comment_id, rating_id) VALUES ('${R}', 'u2', 'spam', '${COMMENT}', '${RATING}')`
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('unique (rating_id, user_id) refuses a second report by one user, not by another', async () => {
    await expect(client.exec(flag('rating_id', RATING))).rejects.toMatchObject({
      code: '23505',
    });
    await client.exec(
      `INSERT INTO recipe_flags (recipe_id, user_id, reason, rating_id) VALUES ('${R}', 'u3', 'spam', '${RATING}')`
    );
  });

  it('FK refuses a report on a rating that does not exist', async () => {
    await expect(
      client.exec(
        `INSERT INTO recipe_flags (recipe_id, user_id, reason, rating_id) VALUES ('${R}', 'u4', 'spam', '${RATING_2}')`
      )
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('deleting a rating deletes its reports and no others', async () => {
    const before = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM recipe_flags');
    const ofRating = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM recipe_flags WHERE rating_id = '${RATING}'`
    );
    expect(ofRating.rows[0].n).toBeGreaterThan(0);
    await client.exec(`DELETE FROM recipe_ratings WHERE id = '${RATING}'`);
    const after = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM recipe_flags');
    expect(after.rows[0].n).toBe(before.rows[0].n - ofRating.rows[0].n);
    const left = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM recipe_flags WHERE rating_id IS NOT NULL`
    );
    expect(left.rows[0].n).toBe(0);
  });
});
