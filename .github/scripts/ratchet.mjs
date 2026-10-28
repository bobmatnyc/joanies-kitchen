#!/usr/bin/env node
// #72: error-list ratchet for the tsc and biome CI jobs. No dependencies.
//
// Why: comparing error COUNTS lets a new error hide behind a fixed old one.
// What: reduces tool output to a multiset of keys (tsc: `path:TScode`, biome: `path:rule`),
//   then fails if any key is new or its count rose above the committed baseline.
// Test: .github/scripts/ratchet.test.mjs
//
// Baseline file: one `key count` pair per line, sorted by key.
// Usage:
//   node ratchet.mjs check    <tsc|biome> <tool-output-file> <tool-exit-code> <baseline-file>
//   node ratchet.mjs generate <tsc|biome> <tool-output-file> <tool-exit-code>   (baseline on stdout)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TSC_LINE = /^(.+?)\(\d+,\d+\): error (TS\d+):/;

function tally(keys) {
  const m = new Map();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

/** Parse tsc output. Returns { counts } or { failure } (fail closed). */
export function parseTsc(log, rc) {
  const lines = String(log ?? '').split(/\r?\n/);
  if (lines.some((l) => /^error TS\d+/.test(l))) {
    return { failure: 'tsc reported a global (non-file) error; bad invocation or config' };
  }
  const keys = [];
  for (const l of lines) {
    const m = TSC_LINE.exec(l);
    if (m) keys.push(`${m[1]}:${m[2]}`);
  }
  if (!Number.isInteger(rc) || rc < 0 || rc > 2) return { failure: `tsc exited ${rc} (crash or bad invocation)` };
  if (rc !== 0 && keys.length === 0) {
    return { failure: `tsc exited ${rc} without reporting any error TS line (crash or bad invocation)` };
  }
  if (rc === 0 && keys.length > 0) return { failure: 'tsc exited 0 but the log has error TS lines; unexpected output' };
  return { counts: tally(keys) };
}

/** Parse `biome check --reporter=json` output. Returns { counts } or { failure }. */
export function parseBiome(text, rc) {
  if (!Number.isInteger(rc) || rc < 0 || rc > 1) return { failure: `biome exited ${rc} (crash or config error)` };
  let j;
  try {
    j = JSON.parse(String(text ?? ''));
  } catch (e) {
    return { failure: `could not parse biome JSON: ${e.message}` };
  }
  if (!j || !Array.isArray(j.diagnostics) || !j.summary || !Number.isInteger(j.summary.errors)) {
    return { failure: 'biome JSON lacks diagnostics[] / summary.errors' };
  }
  const keys = [];
  for (const d of j.diagnostics.filter((x) => x.severity === 'error')) {
    const file = d.location?.path?.file;
    if (typeof file !== 'string' || typeof d.category !== 'string') {
      return { failure: 'biome error diagnostic without file or category' };
    }
    keys.push(`${file}:${d.category}`);
  }
  if (keys.length !== j.summary.errors) {
    return { failure: `biome summary says ${j.summary.errors} errors but ${keys.length} diagnostics parsed` };
  }
  if (rc === 1 && keys.length === 0) return { failure: 'biome exited 1 but reported no errors' };
  return { counts: tally(keys) };
}

export function formatBaseline(counts) {
  return [...counts.keys()]
    .sort()
    .map((k) => `${k} ${counts.get(k)}\n`)
    .join('');
}

/** Parse a baseline file. Throws on a malformed line. */
export function parseBaseline(text) {
  const m = new Map();
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const r = /^(.+) (\d+)$/.exec(line);
    if (!r || Number(r[2]) < 1 || m.has(r[1])) throw new Error(`malformed baseline line: ${line}`);
    m.set(r[1], Number(r[2]));
  }
  return m;
}

/** Compare current counts to baseline. `bad` fails the job; `lowered` only earns a notice. */
export function compare(baseline, current) {
  const bad = [];
  const lowered = [];
  for (const [k, n] of current) {
    const b = baseline.get(k);
    if (b === undefined) bad.push({ key: k, baseline: 0, current: n });
    else if (n > b) bad.push({ key: k, baseline: b, current: n });
  }
  for (const [k, b] of baseline) {
    const n = current.get(k) ?? 0;
    if (n < b) lowered.push({ key: k, baseline: b, current: n });
  }
  return { bad, lowered };
}

function run(argv) {
  const [mode, tool, file, rcArg, baselineFile] = argv;
  const parse = tool === 'tsc' ? parseTsc : tool === 'biome' ? parseBiome : null;
  if (!parse || (mode !== 'check' && mode !== 'generate') || (mode === 'check' && !baselineFile)) {
    console.error('usage: ratchet.mjs check|generate tsc|biome <output-file> <exit-code> [baseline-file]');
    return 2;
  }
  let parsed;
  try {
    parsed = parse(readFileSync(file, 'utf8'), Number(rcArg));
  } catch (e) {
    parsed = { failure: `cannot read ${file}: ${e.message}` };
  }
  if (parsed.failure) {
    console.log(`::error::${tool}: ${parsed.failure}`);
    return 1;
  }
  if (mode === 'generate') {
    process.stdout.write(formatBaseline(parsed.counts));
    return 0;
  }
  let baseline;
  try {
    baseline = parseBaseline(readFileSync(baselineFile, 'utf8'));
  } catch (e) {
    console.log(`::error::${tool}: cannot read baseline ${baselineFile}: ${e.message}`);
    return 1;
  }
  const { bad, lowered } = compare(baseline, parsed.counts);
  const total = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  console.log(`${tool}: ${total(parsed.counts)} errors (baseline: ${total(baseline)})`);
  for (const o of bad) console.log(`  NEW/RAISED ${o.key}: ${o.baseline} -> ${o.current}`);
  for (const o of lowered) console.log(`  fixed ${o.key}: ${o.baseline} -> ${o.current}`);
  if (bad.length) {
    console.log(`::error::${tool}: ${bad.length} error key(s) are new or above baseline (listed above)`);
    return 1;
  }
  if (lowered.length) {
    console.log(
      `::notice::${tool}: errors dropped below baseline; run \`pnpm ci:baseline\` and commit .github/${tool}-baseline.txt`,
    );
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(run(process.argv.slice(2)));
