/**
 * #96 D57: the pinned bge-small model the in-process embedder loads.
 *
 * Why: one manifest shared by the build-time fetch script
 * (`scripts/fetch-embedding-model.ts`), the embedder (`embeddings.ts`) and
 * `next.config.ts`, so the downloaded files, the files the function loads and
 * the files Vercel bundles cannot drift apart.
 * What: the Hugging Face repo, the pinned commit, and each file's size and
 * sha256. No imports and no side effects, so `next.config.ts` can load it.
 */

/** Hugging Face repo holding the ONNX export of BAAI/bge-small-en-v1.5. */
export const EMBEDDING_MODEL_REPO = 'Xenova/bge-small-en-v1.5';

/** #96 D57: pinned commit, so a re-export upstream cannot change the vectors. */
export const EMBEDDING_MODEL_REVISION = 'ea104dacec62c0de699686887e3f920caeb4f3e3';

/** Directory, relative to the project root, that holds `<repo>/<file>`. */
export const EMBEDDING_MODEL_ROOT = 'models';

export interface EmbeddingModelFile {
  path: string;
  bytes: number;
  sha256: string;
}

/** #96 D57: fp32 weights only (`onnx/model.onnx`); q8 is not shipped. */
export const EMBEDDING_MODEL_FILES: readonly EmbeddingModelFile[] = [
  {
    path: 'config.json',
    bytes: 683,
    sha256: 'fa73f90bf92c8cace1fbcb709626306f2bdbc9ea3e5b5f94b440df9b6aa56350',
  },
  {
    path: 'tokenizer.json',
    bytes: 711396,
    sha256: 'd241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66',
  },
  {
    path: 'tokenizer_config.json',
    bytes: 366,
    sha256: '9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3',
  },
  {
    path: 'onnx/model.onnx',
    bytes: 133093490,
    sha256: '828e1496d7fabb79cfa4dcd84fa38625c0d3d21da474a00f08db0f559940cf35',
  },
];
