#!/usr/bin/env node
// Secret check: fails on credentialed DB URLs, Neon `npg_` and Tavily `tvly-` tokens and private-key blocks.
// Why: four committed scripts once carried a live prod Postgres URL; nothing caught it.
// What: scans the given files (default: every git-tracked file) and prints `file:line: <kind>`
//   per finding. It never prints the matched value. Exit 1 on any finding, 0 when clean.
// #125: `--range <base> <head>` instead scans the lines added by each commit in merge-base..head.
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

// #125: the final-tree scan misses a secret added and then removed inside a PR; scan added lines too.
const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 30 });
const tryGit = (args) => {
  try {
    return git(args).trim();
  } catch {
    return '';
  }
};

/**
 * Why: #125 — a commit range's added lines can hold a secret that the final tree no longer has.
 * What: returns `git log` revision args for the commits `head` adds over `base`: `merge-base..head`.
 * A zero or unknown `base` (new branch, force push whose old tip is gone) falls back to the
 * `head` commit alone, with a warning. Unrelated histories scan all of `head`.
 * Test: .github/scripts/check-secrets.test.mjs ("range mode")
 */
export function rangeRevs(base, head = 'HEAD') {
  if (!tryGit(['rev-parse', '--verify', '-q', `${head}^{commit}`])) {
    throw new Error(`check-secrets: head ${head} is not a commit`);
  }
  if (!base || /^0+$/.test(base) || !tryGit(['rev-parse', '--verify', '-q', `${base}^{commit}`])) {
    console.error(`check-secrets: base "${base}" is zero or unknown; scanning ${head} only`);
    return ['-1', head];
  }
  const mb = tryGit(['merge-base', base, head]);
  return mb ? [`${mb}..${head}`] : [head];
}

/**
 * Why: #125 — reuse `scanText` (same patterns, placeholders, ignore annotations) on diff output.
 * What: parses `git log -p -U1` text and returns `{ sha, file, line, kind }` for findings on added
 * lines only. One context line keeps a `secret-check: ignore-next-line` above an added line visible.
 * Test: .github/scripts/check-secrets.test.mjs ("range mode")
 */
export function scanLog(log) {
  const findings = [];
  let sha = '';
  let file = null;
  let hunk = null; // { start, lines: [], added: Set<offset> }
  let oldLeft = 0;
  let newLeft = 0;
  const flush = () => {
    if (!hunk || file === null) return;
    for (const f of scanText(hunk.lines.join('\n'))) {
      if (hunk.added.has(f.line - 1))
        findings.push({ sha, file, line: hunk.start + f.line - 1, kind: f.kind });
    }
    hunk = null;
  };
  for (const l of log.split('\n')) {
    if (oldLeft > 0 || newLeft > 0) {
      // Inside a hunk: line counts from the header decide, so `+++`/`commit` content is not a header.
      if (l.startsWith('\\')) continue; // "\ No newline at end of file"
      const tag = l[0];
      if (tag === '-') {
        oldLeft--;
        continue;
      }
      if (tag === '+') hunk.added.add(hunk.lines.length);
      else oldLeft--; // context line (' ' or an empty line)
      hunk.lines.push(l.slice(1));
      newLeft--;
      continue;
    }
    flush();
    const c = /^commit ([0-9a-f]{40})/.exec(l);
    const h = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (c) {
      sha = c[1];
      file = null;
    } else if (l.startsWith('+++ ')) {
      file = l === '+++ /dev/null' ? null : l.slice(4).replace(/^b\//, '');
    } else if (h) {
      oldLeft = h[1] === undefined ? 1 : Number(h[1]);
      newLeft = h[3] === undefined ? 1 : Number(h[3]);
      hunk = { start: Number(h[2]), lines: [], added: new Set() };
    }
  }
  flush();
  return findings;
}

/** #125: scans lines added by the commits in `base..head`; prints `sha file:line: kind`, returns `{ count, commits }`. */
export function runRange(base, head) {
  const revs = rangeRevs(base, head);
  const commits = tryGit(['rev-list', '--no-merges', '--count', ...revs]) || '0';
  const flags = ['-p', '-U1', '--no-merges', '--no-color', '--no-ext-diff', '--no-textconv'];
  const log = git(['-c', 'core.quotePath=false', 'log', ...flags, '--format=commit %H', ...revs]);
  const findings = scanLog(log);
  for (const f of findings) console.error(`${f.sha.slice(0, 12)} ${f.file}:${f.line}: ${f.kind}`);
  return { count: findings.length, commits: Number(commits) };
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
  // #125: `--range <base> <head>` scans the lines added by the commits in merge-base(base, head)..head.
  if (args[0] === '--range') {
    const { count, commits } = runRange(args[1], args[2] || 'HEAD');
    if (count) {
      console.error(
        `check-secrets: ${count} finding(s) in added lines. The secret is in git history:` +
          ' rotate it, then rewrite or drop the commit.'
      );
      process.exit(1);
    }
    console.log(`check-secrets: OK (${commits} commits scanned)`);
    process.exit(0);
  }
  const files = args.length ? args : trackedFiles();
  const n = run(files);
  if (n) {
    console.error(`check-secrets: ${n} finding(s). Remove the secret, or mark a dummy line with "${IGNORE}".`);
    process.exit(1);
  }
  console.log(`check-secrets: OK (${files.length} files scanned)`);
}
