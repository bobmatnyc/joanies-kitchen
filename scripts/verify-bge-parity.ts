/**
 * #96 D57: re-embeds N stored recipe vectors with the in-process bge-small
 * embedder and asserts each matches (cosine >= 0.99, norm ~1, length 384).
 *
 * Usage:
 *   pnpm exec tsx scripts/verify-bge-parity.ts <database-url> [--limit=20] [--model-name=BAAI/bge-small-en-v1.5]
 *
 * Read-only: one SELECT. The URL is a required argument, never read from the
 * environment, so the target database is always an explicit choice. Rows are
 * filtered to `model_name` (default the Python bge-small label), since rows
 * written by another model are expected to differ. Exits 1 if any row fails.
 * Needs the model on disk: `pnpm exec tsx scripts/fetch-embedding-model.ts`.
 */
import postgres from 'postgres';
import { checkParityRows, type StoredEmbeddingRow } from '../src/lib/ai/bge-parity';
import { generateEmbedding } from '../src/lib/ai/embeddings';

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function main(): Promise<number> {
  const url = process.argv[2];
  if (!url || url.startsWith('--')) {
    console.error('usage: verify-bge-parity.ts <database-url> [--limit=N] [--model-name=NAME]');
    return 2;
  }
  const limit = Number.parseInt(arg('limit', '20'), 10);
  const modelName = arg('model-name', 'BAAI/bge-small-en-v1.5');

  const sql = postgres(url, { max: 1 });
  let rows: StoredEmbeddingRow[];
  try {
    rows = await sql<StoredEmbeddingRow[]>`
      SELECT recipe_id, embedding_text, embedding::text AS embedding
      FROM recipe_embeddings
      WHERE model_name = ${modelName}
      ORDER BY random()
      LIMIT ${limit}`;
  } finally {
    await sql.end();
  }
  if (rows.length === 0) {
    console.error(`no recipe_embeddings rows with model_name=${modelName}`);
    return 1;
  }

  const results = await checkParityRows(rows, (text) => generateEmbedding(text));
  for (const r of results) {
    console.log(
      `${r.ok ? 'ok  ' : 'FAIL'} ${r.recipeId} cosine=${r.cosine.toFixed(6)} norm=${r.norm.toFixed(6)} len=${r.length}`
    );
  }
  const failed = results.filter((r) => !r.ok).length;
  const minCosine = Math.min(...results.map((r) => r.cosine));
  console.log(`${results.length - failed}/${results.length} rows pass; min cosine ${minCosine.toFixed(6)}`);
  return failed === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error('[verify-bge-parity]', error instanceof Error ? error.message : error);
    process.exit(1);
  });
