// Unit tests for check-secrets.mjs. Fixtures are built at runtime so this file holds no credential literal.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isPlaceholder, scanText } from './check-secrets.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-secrets.mjs');
const FAKE_PW = ['fake', 'Not', 'Real', '9876'].join('');
const url = (scheme, pw) => `${scheme}://someuser:${pw}@db.example.invalid/app`;

describe('scanText', () => {
  it.each(['postgres', 'postgresql', 'mysql', 'mongodb', 'mongodb+srv'])('flags a credentialed %s URL', (s) => {
    expect(scanText(`x\nconst u = '${url(s, FAKE_PW)}';`)).toEqual([{ line: 2, kind: 'credentialed database URL' }]);
  });
  it('flags npg_ tokens and private-key blocks', () => {
    const text = `t = "npg_${'A1b2C3d4E5'}"\n-----BEGIN RSA ${'PRIVATE'} KEY-----`;
    expect(scanText(text).map((f) => f.kind)).toEqual(['Neon npg_ token', 'private key block']);
  });
  it.each([['tvly', 'dev', 'abcdefghijklmnopqrstuvwxyzabcdef'], ['tvly', 'AbC123dEf456GhI789jKl0']])('flags a Tavily key %#', (...p) => {
    expect(scanText(`k=${p.join('-')}`)).toEqual([{ line: 1, kind: 'Tavily tvly- key' }]);
  });
  it('allows the Tavily placeholder', () => {
    expect(scanText('TAVILY_API_KEY=tvly-your-key-here')).toEqual([]);
  });
  it.each(['password', 'pass', '***', '<password>', '${PGPASSWORD}', '$PGPASSWORD', 'ci'])('allows placeholder %s', (pw) => {
    expect(isPlaceholder(pw)).toBe(true);
    expect(scanText(url('postgresql', pw))).toEqual([]);
  });
  it('honours the ignore annotation', () => {
    expect(scanText(`${url('postgres', FAKE_PW)} // secret-check: ignore`)).toEqual([]);
    expect(scanText(`// secret-check: ignore-next-line\n${url('postgres', FAKE_PW)}`)).toEqual([]);
  });
});

describe('CLI', () => {
  it('fails on a fixture with file:line output and never echoes the value', () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-secrets-'));
    const file = join(dir, 'leak.ts');
    writeFileSync(file, `// fixture\nexport const u = '${url('postgresql', FAKE_PW)}';\n`);
    let status = 0;
    let stderr = '';
    try {
      execFileSync('node', [SCRIPT, file], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      status = e.status;
      stderr = String(e.stderr);
    }
    expect(status).toBe(1);
    expect(stderr).toContain(`${file}:2: credentialed database URL`);
    expect(stderr).not.toContain(FAKE_PW);
  });
});

// #125: a secret added in one commit and removed in a later one leaves the final tree clean.
describe('range mode', () => {
  const G = [
    'user.name=t',
    'user.email=t@example.invalid',
    'core.hooksPath=/dev/null',
    'commit.gpgsign=false',
  ].flatMap((kv) => ['-c', kv]);
  const repo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-secrets-range-'));
    const g = (...a) => execFileSync('git', [...G, ...a], { cwd: dir, encoding: 'utf8' }).trim();
    g('init', '-q', '-b', 'main');
    const commit = (name, text) => {
      writeFileSync(join(dir, name), text);
      g('add', '-A');
      g('commit', '-q', '-m', name);
      return g('rev-parse', 'HEAD');
    };
    return { dir, commit };
  };
  const cli = (cwd, ...args) => {
    try {
      const out = execFileSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
      return { status: 0, out, err: '' };
    } catch (e) {
      return { status: e.status, out: String(e.stdout), err: String(e.stderr) };
    }
  };

  it('fails on a secret added then removed, naming sha and file:line without the value', () => {
    const { dir, commit } = repo();
    const base = commit('a.ts', 'export const a = 1;\n');
    const leak = commit('a.ts', `export const a = 1;\nconst u = '${url('postgres', FAKE_PW)}';\n`);
    const head = commit('a.ts', 'export const a = 1;\n');
    expect(cli(dir).status).toBe(0); // the final tree is clean
    const r = cli(dir, '--range', base, head);
    expect(r.status).toBe(1);
    expect(r.err).toContain(`${leak.slice(0, 12)} a.ts:2: credentialed database URL`);
    expect(r.err).not.toContain(FAKE_PW);
  });

  it('passes a clean range and honours ignore-next-line from a context line', () => {
    const { dir, commit } = repo();
    const base = commit('a.ts', '// secret-check: ignore-next-line\nconst u = 1;\n');
    const dummy = `const u = '${url('postgres', FAKE_PW)}';`;
    const head = commit('a.ts', `// secret-check: ignore-next-line\n${dummy}\n`);
    const r = cli(dir, '--range', base, head);
    expect(r.status).toBe(0);
    expect(r.out).toContain('check-secrets: OK (1 commits scanned)');
  });

  it('scans the head commit when base is the zero sha', () => {
    const { dir, commit } = repo();
    commit('a.ts', 'export const a = 1;\n');
    const head = commit('b.ts', `const u = '${url('mysql', FAKE_PW)}';\n`);
    const r = cli(dir, '--range', '0'.repeat(40), head);
    expect(r.status).toBe(1);
    expect(r.err).toContain(`${head.slice(0, 12)} b.ts:1: credentialed database URL`);
    expect(r.err).not.toContain(FAKE_PW);
  });
});
