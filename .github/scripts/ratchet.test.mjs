// #72: unit tests for ratchet.mjs.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compare, formatBaseline, parseBaseline, parseBiome, parseTsc } from './ratchet.mjs';

const tscLog = (...codes) => codes.map(([f, c], i) => `${f}(${i + 1},2): error ${c}: x\n  continuation line`).join('\n');
const biomeJson = (diags) =>
  JSON.stringify({
    summary: { errors: diags.filter((d) => d[2] === 'error').length },
    diagnostics: diags.map(([file, category, severity]) => ({ category, severity, location: { path: { file } } })),
  });

describe('compare', () => {
  const baseline = parseBaseline('a.ts:TS1 2\nb.ts:TS2 1\n');
  it('fails on a new key (total count unchanged)', () => {
    const cur = parseTsc(tscLog(['a.ts', 'TS1'], ['a.ts', 'TS1'], ['c.ts', 'TS9']), 2).counts;
    expect(compare(baseline, cur).bad).toEqual([{ key: 'c.ts:TS9', baseline: 0, current: 1 }]);
  });
  it('fails on a higher count of a known key', () => {
    const cur = parseTsc(tscLog(['a.ts', 'TS1'], ['a.ts', 'TS1'], ['a.ts', 'TS1'], ['b.ts', 'TS2']), 2).counts;
    expect(compare(baseline, cur).bad).toEqual([{ key: 'a.ts:TS1', baseline: 2, current: 3 }]);
  });
  it('passes on a lower count and reports it', () => {
    const cur = parseTsc(tscLog(['a.ts', 'TS1'], ['b.ts', 'TS2']), 2).counts;
    const r = compare(baseline, cur);
    expect(r.bad).toEqual([]);
    expect(r.lowered).toEqual([{ key: 'a.ts:TS1', baseline: 2, current: 1 }]);
  });
});

describe('fail closed', () => {
  it('tsc: empty output with a non-zero exit fails', () => {
    expect(parseTsc('', 2).failure).toBeTruthy();
    expect(parseTsc('garbage', 1).failure).toBeTruthy();
  });
  it('tsc: crash exit code, global error, exit 0 with errors fail', () => {
    expect(parseTsc('', 137).failure).toBeTruthy();
    expect(parseTsc("error TS5023: Unknown compiler option 'x'.", 1).failure).toBeTruthy();
    expect(parseTsc(tscLog(['a.ts', 'TS1']), 0).failure).toBeTruthy();
  });
  it('biome: empty or unparseable JSON fails', () => {
    expect(parseBiome('', 1).failure).toBeTruthy();
    expect(parseBiome('not json', 1).failure).toBeTruthy();
    expect(parseBiome('{}', 1).failure).toBeTruthy();
  });
  it('biome: crash exit code fails; exit 1 with no errors fails', () => {
    expect(parseBiome(biomeJson([]), 2).failure).toBeTruthy();
    expect(parseBiome(biomeJson([['a.ts', 'lint/x', 'warning']]), 1).failure).toBeTruthy();
  });
  it('baseline: malformed line throws', () => {
    expect(() => parseBaseline('no-count-here\n')).toThrow();
  });
});

describe('parsing', () => {
  it('tsc keys drop line/column and keep a multiset', () => {
    const { counts } = parseTsc(tscLog(['src/x.ts', 'TS2322'], ['src/x.ts', 'TS2322']), 2);
    expect(formatBaseline(counts)).toBe('src/x.ts:TS2322 2\n');
  });
  it('biome keys are file:rule, errors only', () => {
    const { counts } = parseBiome(
      biomeJson([
        ['a.ts', 'lint/r', 'error'],
        ['a.ts', 'lint/r', 'error'],
        ['a.ts', 'lint/w', 'warning'],
      ]),
      1,
    );
    expect(formatBaseline(counts)).toBe('a.ts:lint/r 2\n');
  });
  it('baseline round-trips', () => {
    const t = 'a:TS1 3\nb:TS2 1\n';
    expect(formatBaseline(parseBaseline(t))).toBe(t);
  });
});

describe('biome fatal', () => {
  it('fails on a fatal diagnostic', () => {
    const t = JSON.stringify({
      summary: { errors: 1 },
      diagnostics: [
        { category: 'lint/r', severity: 'error', location: { path: { file: 'a.ts' } } },
        { category: 'parse', severity: 'fatal', location: { path: { file: 'b.ts' } } },
      ],
    });
    expect(parseBiome(t, 1).failure).toMatch(/fatal/);
  });
});

describe('CLI', () => {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'ratchet.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'ratchet-'));
  const w = (n, c) => {
    const f = join(dir, n);
    writeFileSync(f, c);
    return f;
  };
  const run = (...args) => {
    try {
      execFileSync('node', [script, 'check', ...args], { stdio: 'pipe' });
      return 0;
    } catch (e) {
      return e.status;
    }
  };
  const log = w('t.log', 'a.ts(1,1): error TS1: x\n');
  const bl = w('bl.txt', 'a.ts:TS1 1\n');
  it('passes cleanly', () => expect(run('tsc', log, '2', bl)).toBe(0));
  it('fails on a new key', () => expect(run('tsc', log, '2', w('bl2.txt', 'z.ts:TS9 1\n'))).toBe(1));
  it('fails on a missing baseline', () => expect(run('tsc', log, '2', join(dir, 'nope.txt'))).toBe(1));
  it('fails on a crash rc', () => expect(run('tsc', w('e.log', ''), '137', bl)).toBe(1));
  it('fails on an empty rc argument', () => expect(run('tsc', log, '', bl)).toBe(1));
});
