/**
 * PGlite stand-in for pgvector, shared by the similarity-search tests.
 *
 * Why: the bundled PGlite (0.5.x) ships no pgvector extension, so `vector`,
 * `<=>` and HNSW indexes do not exist there.
 * What: a `vector` domain over text, a SQL cosine-distance `<=>` operator on
 * the stored JSON text, and a `recipe_embeddings` table. No index: query plans
 * against the real HNSW index are covered by the #131 Neon dry run.
 * Test: `src/lib/db/__tests__/embeddings-soft-delete.test.ts`,
 * `src/lib/db/__tests__/embeddings-knn.test.ts`
 */

import type { PGlite } from '@electric-sql/pglite';

/** Body of the cosine-distance function behind the stub `<=>` operator. */
export const COSINE_DISTANCE_SQL = `
  SELECT 1 - sum(x * y) / (sqrt(sum(x * x)) * sqrt(sum(y * y)))
  FROM unnest(string_to_array(btrim(a, '[] '), ',')::float8[],
              string_to_array(btrim(b, '[] '), ',')::float8[]) AS t(x, y)`;

/** Creates the `vector` domain, the `<=>` operator and `recipe_embeddings`. */
export async function installVectorStub(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE DOMAIN vector AS text;
    CREATE FUNCTION jk_cosine_distance(a text, b text) RETURNS float8
      LANGUAGE sql IMMUTABLE AS $$ ${COSINE_DISTANCE_SQL} $$;
    CREATE OPERATOR <=> (LEFTARG = text, RIGHTARG = text, FUNCTION = jk_cosine_distance);
    CREATE TABLE "recipe_embeddings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "recipe_id" text NOT NULL UNIQUE,
      "embedding" text NOT NULL,
      "embedding_text" text NOT NULL,
      "model_name" varchar(100) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
      "created_at" timestamptz DEFAULT now(),
      "updated_at" timestamptz DEFAULT now()
    );
  `);
}

/** 384-dim vector with the given non-zero components. */
export function vec(components: Record<number, number>): number[] {
  const v = new Array<number>(384).fill(0);
  for (const [i, x] of Object.entries(components)) v[Number(i)] = x;
  return v;
}
