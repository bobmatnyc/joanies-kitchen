// @vitest-environment node
/**
 * #96 D57: the in-process embedder must reproduce the vectors the Python
 * pipeline wrote to the DB (sentence-transformers BAAI/bge-small-en-v1.5,
 * normalize_embeddings=True, no prefix). The fixture was produced by
 * `fixtures/make_bge_reference.py`. Skips when the model has not been fetched
 * (`pnpm exec tsx scripts/fetch-embedding-model.ts`).
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMBEDDING_MODEL_REPO, EMBEDDING_MODEL_ROOT } from '../embedding-model';
import {
  cosineSimilarity,
  generateEmbedding,
  generateEmbeddingsBatch,
  generateQueryEmbedding,
} from '../embeddings';
import reference from './fixtures/bge-small-reference.json';

const modelFile = path.join(
  process.cwd(),
  EMBEDDING_MODEL_ROOT,
  EMBEDDING_MODEL_REPO,
  'onnx/model.onnx'
);
const MIN_COSINE = 0.99;

function norm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

describe.skipIf(!existsSync(modelFile))(
  '#96 D57 bge-small parity with sentence-transformers',
  () => {
    it('matches the Python sentence-transformers vectors', async () => {
      const cosines: number[] = [];
      for (const passage of reference.passages) {
        const vector = await generateEmbedding(passage.text);
        expect(vector).toHaveLength(384);
        expect(norm(vector)).toBeCloseTo(1, 4);
        cosines.push(cosineSimilarity(vector, passage.embedding));
      }
      console.log('[parity] passage cosines', cosines.map((c) => c.toFixed(6)).join(' '));
      for (const c of cosines) expect(c).toBeGreaterThanOrEqual(MIN_COSINE);
    }, 120_000);

    it('keeps [SEP] when truncating a text over 512 tokens', async () => {
      // #96 D57: without the [SEP] repair this passage scores ~0.994, which passes 0.99 but is not exact.
      const long = reference.passages[4];
      const c = cosineSimilarity(await generateEmbedding(long.text), long.embedding);
      expect(c).toBeGreaterThanOrEqual(0.9999);
    }, 120_000);

    it('matches in a padded batch', async () => {
      const vectors = await generateEmbeddingsBatch(reference.passages.map((p) => p.text));
      expect(vectors).toHaveLength(reference.passages.length);
      vectors.forEach((v, i) => {
        expect(cosineSimilarity(v, reference.passages[i].embedding)).toBeGreaterThanOrEqual(
          MIN_COSINE
        );
      });
    }, 120_000);

    it('matches the prefixed query vector', async () => {
      for (const q of reference.queries) {
        const vector = await generateQueryEmbedding(q.query);
        const c = cosineSimilarity(vector, q.embedding);
        console.log('[parity] query cosine', c.toFixed(6));
        expect(c).toBeGreaterThanOrEqual(MIN_COSINE);
      }
    }, 120_000);
  }
);
