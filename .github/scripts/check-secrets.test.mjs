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
