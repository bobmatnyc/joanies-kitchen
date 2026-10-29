/**
 * #96 D57: parity checks between stored recipe vectors and the in-process
 * bge-small embedder. Pure logic, shared by `scripts/verify-bge-parity.ts`
 * and its unit test; it opens no connection and loads no model itself.
 */

import { cosineSimilarity } from './embeddings';

export const PARITY_MIN_COSINE = 0.99;
export const PARITY_NORM_TOLERANCE = 1e-3;
export const PARITY_DIMENSION = 384;

export interface StoredEmbeddingRow {
  recipe_id: string;
  embedding_text: string;
  /** pgvector text form (`[0.1,0.2,...]`) or an already-parsed array. */
  embedding: string | number[];
}

export interface ParityResult {
  recipeId: string;
  cosine: number;
  norm: number;
  length: number;
  ok: boolean;
}

/** Parses pgvector's `[a,b,c]` text form; arrays pass through. */
export function parsePgVector(value: string | number[]): number[] {
  if (Array.isArray(value)) return value;
  return value
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((part) => Number(part));
}

function l2Norm(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
}

/**
 * Why: before the stored vectors are trusted as the same space as live
 * queries, each sampled row must re-embed to (almost) the same vector (#96 D57).
 * What: Re-embeds each row's `embedding_text` with `embed` and reports the
 * cosine against the stored vector, the fresh vector's L2 norm and length.
 * A row is ok when cosine >= 0.99, |norm - 1| <= 1e-3 and length is 384.
 * Test: `flags a row whose stored vector is a different model`, `passes rows that re-embed to the stored vector`
 */
export async function checkParityRows(
  rows: readonly StoredEmbeddingRow[],
  embed: (text: string) => Promise<number[]>
): Promise<ParityResult[]> {
  const results: ParityResult[] = [];
  for (const row of rows) {
    const stored = parsePgVector(row.embedding);
    const fresh = await embed(row.embedding_text);
    const norm = l2Norm(fresh);
    const cosine = fresh.length === stored.length ? cosineSimilarity(fresh, stored) : Number.NaN;
    results.push({
      recipeId: row.recipe_id,
      cosine,
      norm,
      length: fresh.length,
      ok:
        cosine >= PARITY_MIN_COSINE &&
        Math.abs(norm - 1) <= PARITY_NORM_TOLERANCE &&
        fresh.length === PARITY_DIMENSION &&
        stored.length === PARITY_DIMENSION,
    });
  }
  return results;
}
