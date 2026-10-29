/**
 * #96 D57: post-build check that every function which loads the embedder ships its files.
 *
 * Why: `outputFileTracingIncludes` keys are route globs, and a key that misses
 * a route (as `/**\/*` missed `/`) builds clean and fails only in production
 * with `CONFIG_ERROR`.
 * What: reads every `.next/server/**\/*.nft.json`. A trace that lists
 * `@huggingface/transformers` must also list `onnx/model.onnx` and the
 * linux-x64 `onnxruntime_binding.node`, must list no darwin, win32 or arm64
 * onnxruntime build, and must stay under Vercel's 250 MB function limit. The
 * root page trace (`app/page.js.nft.json`) must be one of them. It checks for
 * linux-x64 on every host, including macOS: Vercel runs linux-x64, and the
 * config strips the darwin builds on every host, so a host-platform check
 * could never pass. Exits 1 on any failure. Run after `next build`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const TRANSFORMERS = /node_modules\/@huggingface\/transformers\//;
const MODEL = /models\/.*\/onnx\/model\.onnx$/;
const LINUX_X64_BINDING =
  /onnxruntime-node\/bin\/napi-v\d+\/linux\/x64\/onnxruntime_binding\.node$/;
const FOREIGN_ONNX = /onnxruntime-node\/bin\/napi-v\d+\/(darwin|win32|linux\/arm64)\//;
const VERCEL_FUNCTION_LIMIT = 250 * 1024 * 1024;
const ROOT_PAGE_TRACE = path.join('app', 'page.js.nft.json');

const serverDir = path.resolve(__dirname, '..', '.next', 'server');
const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function traceBytes(traceDir: string, files: string[]): number {
  let total = 0;
  for (const file of files) {
    const full = path.resolve(traceDir, file);
    if (existsSync(full)) total += statSync(full).size;
  }
  return total;
}

function main(): number {
  if (!existsSync(serverDir)) {
    console.error(`[check-embedding-traces] ${serverDir} not found; run next build first`);
    return 1;
  }
  const traces = readdirSync(serverDir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.nft.json'))
    .sort();
  const failures: string[] = [];
  const embedderTraces: string[] = [];
  let largest = { trace: '', bytes: 0 };

  for (const trace of traces) {
    const tracePath = path.join(serverDir, trace);
    const files: string[] = JSON.parse(readFileSync(tracePath, 'utf8')).files;
    if (!files.some((f) => TRANSFORMERS.test(f))) continue;
    embedderTraces.push(trace);
    const bytes = traceBytes(path.dirname(tracePath), files);
    if (bytes > largest.bytes) largest = { trace, bytes };

    const problems: string[] = [];
    if (!files.some((f) => MODEL.test(f))) problems.push('no onnx/model.onnx');
    if (!files.some((f) => LINUX_X64_BINDING.test(f))) {
      problems.push('no linux/x64/onnxruntime_binding.node');
    }
    const foreign = files.filter((f) => FOREIGN_ONNX.test(f));
    if (foreign.length > 0) problems.push(`${foreign.length} foreign onnxruntime files`);
    if (bytes > VERCEL_FUNCTION_LIMIT) problems.push(`${mb(bytes)} is over 250 MB`);
    if (problems.length > 0) failures.push(`${trace} (${mb(bytes)}): ${problems.join('; ')}`);
  }

  if (!embedderTraces.includes(ROOT_PAGE_TRACE)) {
    failures.push(`${ROOT_PAGE_TRACE}: does not trace @huggingface/transformers`);
  }

  console.log(
    `[check-embedding-traces] ${traces.length} traces, ${embedderTraces.length} load the embedder; ` +
      `largest ${largest.trace} ${mb(largest.bytes)}`
  );
  if (failures.length > 0) {
    console.error(`[check-embedding-traces] FAIL: ${failures.length} trace(s)`);
    for (const failure of failures) console.error(`  ${failure}`);
    return 1;
  }
  console.log('[check-embedding-traces] OK');
  return 0;
}

process.exit(main());
