#!/usr/bin/env node
// Secret check: fails on credentialed DB URLs, Neon `npg_` and Tavily `tvly-` tokens and private-key blocks.
// Why: four committed scripts once carried a live prod Postgres URL; nothing caught it.
// What: scans the given files (default: every git-tracked file) and prints `file:line: <kind>`
//   per finding. It never prints the matched value. Exit 1 on any finding, 0 when clean.
// Ignore a line with `secret-check: ignore` on it, or `secret-check: ignore-next-line` on the line above.
// Test: .github/scripts/check-secrets.test.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const URL_RE = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/([^\s:/@"'`]+):([^\s@"'`]+)@/gi;
const NPG_RE = /\bnpg_[A-Za-z0-9]{8,}/;
const TVLY_RE = /\btvly-(?:[a-z]+-)?[A-Za-z0-9]{20,}/;
const KEY_RE = /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/;
const IGNORE = 'secret-check: ignore';
const IGNORE_NEXT = 'secret-check: ignore-next-line';

// Obvious placeholder passwords. Template forms (`<...>`, `${...}`, `$VAR`, `***`, `xxx`) are matched by shape.
const PLACEHOLDERS = new Set([
  'password', 'pass', 'pwd', 'passwd', 'secret', 'changeme', 'example', 'placeholder',
  'test', 'ci', 'postgres', 'your-password', 'your_password', 'yourpassword', 'mypassword',
]);
const PLACEHOLDER_SHAPE = /^(?:<[^>]*>|\$\{[^}]*\}|\$[A-Z_][A-Z0-9_]*|\*+|x+|\.\.\.|\[[^\]]*\])$/i;

/** True when `pw` is an obvious placeholder, not a real secret. */
export function isPlaceholder(pw) {
  return PLACEHOLDERS.has(pw.toLowerCase()) || PLACEHOLDER_SHAPE.test(pw);
}

/** Returns `{ line, kind }` findings for one file's text. Values are never included. */
export function scanText(text) {
  const findings = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line.includes(IGNORE)) return; // also covers `secret-check: ignore-next-line` itself
    if (i > 0 && lines[i - 1].includes(IGNORE_NEXT)) return;
    for (const m of line.matchAll(URL_RE)) {
      if (!isPlaceholder(m[2])) findings.push({ line: i + 1, kind: 'credentialed database URL' });
    }
    if (NPG_RE.test(line)) findings.push({ line: i + 1, kind: 'Neon npg_ token' });
    if (TVLY_RE.test(line)) findings.push({ line: i + 1, kind: 'Tavily tvly- key' });
    if (KEY_RE.test(line)) findings.push({ line: i + 1, kind: 'private key block' });
  });
  return findings;
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
}

/** Scans `files`, prints `file:line: kind` per finding, returns the finding count. */
export function run(files) {
  let count = 0;
  for (const file of files) {
    let buf;
    try {
      buf = readFileSync(file);
    } catch {
      continue; // deleted in the working tree, or a submodule path
    }
    if (buf.includes(0)) continue; // binary
    for (const f of scanText(buf.toString('utf8'))) {
      console.error(`${file}:${f.line}: ${f.kind}`);
      count++;
    }
  }
  return count;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const files = args.length ? args : trackedFiles();
  const n = run(files);
  if (n) {
    console.error(`check-secrets: ${n} finding(s). Remove the secret, or mark a dummy line with "${IGNORE}".`);
    process.exit(1);
  }
  console.log(`check-secrets: OK (${files.length} files scanned)`);
}
