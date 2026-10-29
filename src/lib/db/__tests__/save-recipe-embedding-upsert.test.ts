// @vitest-environment node
/**
 * recipe_embeddings_recipe_id_unique (0001): saveRecipeEmbedding must upsert.
 *
 * Why: migration 0001 made recipe_id unique; a read-then-insert save throws
 * 23505 when two saves for one recipe race.
 * What: runs saveRecipeEmbedding against PGlite with the unique constraint and
 * checks one row holding the latest embedding remains.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { recipeEmbeddings, recipes } from '@/lib/db/schema';

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({
  get db() {
    return holder.db;
  },
}));

import { saveRecipeEmbedding } from '../embeddings';

let client: PGlite;
const vec = (v: number): number[] => Array.from({ length: 384 }, () => v);

beforeAll(async () => {
  const built = await createVisibilityDb([recipes], { recipes, recipeEmbeddings });
  client = built.client;
  holder.db = built.db;
  // PGlite here ships no pgvector; text stores the JSON the custom type writes.
  await client.exec(`CREATE TABLE "recipe_embeddings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "recipe_id" text NOT NULL,
    "embedding" text NOT NULL,
    "embedding_text" text NOT NULL,
    "model_name" varchar(100) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now(),
    CONSTRAINT "recipe_embeddings_recipe_id_unique" UNIQUE ("recipe_id")
  );`);
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec(`DELETE FROM "recipe_embeddings"; DELETE FROM "recipes";
    INSERT INTO "recipes" ("id", "name") VALUES ('r1', 'Soup');`);
});

async function rows(): Promise<Array<{ embedding: string; model_name: string }>> {
  const res = await client.query<{ embedding: string; model_name: string }>(
    `SELECT "embedding", "model_name" FROM "recipe_embeddings" WHERE "recipe_id" = 'r1'`
  );
  return res.rows;
}

describe('saveRecipeEmbedding upsert on recipe_id', () => {
  it('a repeat save replaces the row', async () => {
    await saveRecipeEmbedding('r1', vec(0.1), 'first', 'm1');
    await saveRecipeEmbedding('r1', vec(0.2), 'second', 'm2');
    const got = await rows();
    expect(got).toHaveLength(1);
    expect(JSON.parse(got[0]?.embedding ?? '[]')[0]).toBe(0.2);
    expect(got[0]?.model_name).toBe('m2');
  });

  it('concurrent saves never throw 23505 and leave one row', async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      await client.exec(`DELETE FROM "recipe_embeddings";`);
      const results = await Promise.allSettled([
        saveRecipeEmbedding('r1', vec(0.3), 'a', 'm3'),
        saveRecipeEmbedding('r1', vec(0.4), 'b', 'm4'),
      ]);
      const failures = results.filter((r) => r.status === 'rejected');
      expect(failures, `attempt ${attempt}`).toEqual([]);
      const got = await rows();
      expect(got).toHaveLength(1);
      expect(JSON.parse(got[0]?.embedding ?? '[]')[0]).toBe(0.4);
    }
  });
});
