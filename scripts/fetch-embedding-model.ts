/**
 * #96 D57: downloads the pinned bge-small ONNX model into models/ at build time.
 *
 * Why: the embedder runs in-process with `allowRemoteModels=false`, so the
 * model must be on disk before `next build` traces it into the function. The
 * 133 MB fp32 weights are not committed (see test/scripts/README-EMBEDDINGS.md).
 * What: for each file in `EMBEDDING_MODEL_FILES`, keeps a local copy whose
 * sha256 matches, else downloads it from the pinned Hugging Face commit and
 * verifies byte size and sha256 before moving it into place. Each download
 * attempt times out after 120 s and is tried 3 times with backoff
 * (`scripts/lib/with-retry.ts`). A mismatch or the last failed attempt exits
 * 1, which fails the build. Runs in `prebuild`; never at request time.
 */
import { createHash } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  EMBEDDING_MODEL_FILES,
  EMBEDDING_MODEL_REPO,
  EMBEDDING_MODEL_REVISION,
  EMBEDDING_MODEL_ROOT,
  type EmbeddingModelFile,
} from '../src/lib/ai/embedding-model';
import { withRetry } from './lib/with-retry';

const root = path.resolve(__dirname, '..');
const modelDir = path.join(root, EMBEDDING_MODEL_ROOT, EMBEDDING_MODEL_REPO);

async function sha256Of(file: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

/** One attempt: streams `url` to `partial`, then checks byte size and sha256. */
async function downloadVerified(
  url: string,
  partial: string,
  file: EmbeddingModelFile,
  signal: AbortSignal
): Promise<void> {
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) {
    throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(partial));
  const bytes = statSync(partial).size;
  if (bytes !== file.bytes) {
    throw new Error(`${file.path}: ${bytes} bytes, pinned size is ${file.bytes}`);
  }
  const actual = await sha256Of(partial);
  if (actual !== file.sha256) {
    throw new Error(`${file.path}: sha256 ${actual} does not match pinned ${file.sha256}`);
  }
}

async function ensureFile(file: EmbeddingModelFile): Promise<'cached' | 'downloaded'> {
  const target = path.join(modelDir, file.path);
  if (existsSync(target) && (await sha256Of(target)) === file.sha256) return 'cached';

  mkdirSync(path.dirname(target), { recursive: true });
  const url = `https://huggingface.co/${EMBEDDING_MODEL_REPO}/resolve/${EMBEDDING_MODEL_REVISION}/${file.path}`;
  const partial = `${target}.partial`;
  try {
    await withRetry((signal) => downloadVerified(url, partial, file, signal), {
      attempts: 3,
      timeoutMs: 120_000,
      backoffMs: 2_000,
      onRetry: (n, error) =>
        console.warn(`[fetch-embedding-model] ${file.path}: attempt ${n} failed:`, error),
    });
  } catch (error) {
    rmSync(partial, { force: true });
    throw error;
  }
  renameSync(partial, target);
  return 'downloaded';
}

async function main(): Promise<void> {
  for (const file of EMBEDDING_MODEL_FILES) {
    const state = await ensureFile(file);
    console.log(`[fetch-embedding-model] ${file.path}: ${state} (${file.bytes} bytes)`);
  }
}

main().catch((error: unknown) => {
  console.error('[fetch-embedding-model]', error instanceof Error ? error.message : error);
  process.exit(1);
});
