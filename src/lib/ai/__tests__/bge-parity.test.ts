// @vitest-environment node
/** #96 D57: logic behind scripts/verify-bge-parity.ts, checked against the reference fixture. */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkParityRows, parsePgVector, type StoredEmbeddingRow } from '../bge-parity';
import { EMBEDDING_MODEL_REPO, EMBEDDING_MODEL_ROOT } from '../embedding-model';
import { generateEmbedding } from '../embeddings';
import reference from './fixtures/bge-small-reference.json';

// Rows shaped as the script reads them: pgvector text form.
const rows: StoredEmbeddingRow[] = reference.passages.map((p, i) => ({
  recipe_id: `r${i}`,
  embedding_text: p.text,
  embedding: `[${p.embedding.join(',')}]`,
}));
const byText = new Map(reference.passages.map((p) => [p.text, p.embedding]));

describe('#96 D57 verify-bge-parity logic', () => {
  it('parses the pgvector text form', () => {
    expect(parsePgVector('[0.5,-1,2e-3]')).toEqual([0.5, -1, 0.002]);
  });

  it('passes rows that re-embed to the stored vector', async () => {
    const results = await checkParityRows(rows, async (text) => byText.get(text) as number[]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.map((r) => r.length)).toEqual([384, 384, 384, 384, 384]);
  });

  it('flags a row whose stored vector is a different model', async () => {
    // Pair each text with another passage's vector: a different vector space stand-in.
    const shifted = reference.passages.map((p) => p.embedding);
    const results = await checkParityRows(rows, async (text) => {
      const i = reference.passages.findIndex((p) => p.text === text);
      return shifted[(i + 1) % shifted.length];
    });
    expect(results.some((r) => !r.ok)).toBe(true);
    expect(Math.min(...results.map((r) => r.cosine))).toBeLessThan(0.99);
  });

  it('flags an unnormalised or wrong-length vector', async () => {
    const [row] = rows;
    const stored = parsePgVector(row.embedding);
    const [scaled] = await checkParityRows([row], async () => stored.map((x) => x * 2));
    expect(scaled.ok).toBe(false); // cosine 1, norm 2
    const [short] = await checkParityRows([row], async () => stored.slice(0, 383));
    expect(short.ok).toBe(false);
  });

  const modelFile = path.join(
    process.cwd(),
    EMBEDDING_MODEL_ROOT,
    EMBEDDING_MODEL_REPO,
    'onnx/model.onnx'
  );
  it.skipIf(!existsSync(modelFile))(
    'passes the fixture rows with the real embedder',
    async () => {
      const results = await checkParityRows(rows, (text) => generateEmbedding(text));
      expect(results.filter((r) => !r.ok)).toEqual([]);
    },
    120_000
  );
});
