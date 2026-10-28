// #24: guard against retired model ids creeping back as string literals at AI call sites.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_MODEL } from '../models';

const RETIRED = 'google/gemini-2.0-flash-exp:free';
const SRC = join(__dirname, '..', '..', '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('#24 OpenRouter default model constant', () => {
  const files = walk(SRC).filter((f) => !f.endsWith('models.ts'));

  it('is not the retired model', () => {
    expect(DEFAULT_AI_MODEL).not.toBe(RETIRED);
  });

  it('no source file hard-codes the retired model id, except cost rates and a schema comment', () => {
    const offenders = files.filter(
      (f) =>
        !f.endsWith('rates.ts') &&
        !f.endsWith('schema.ts') &&
        readFileSync(f, 'utf8').includes(RETIRED)
    );
    expect(offenders).toEqual([]);
  });

  it('every file using DEFAULT_AI_MODEL imports it from the one module', () => {
    const users = files.filter((f) => readFileSync(f, 'utf8').includes('DEFAULT_AI_MODEL'));
    expect(users.length).toBeGreaterThanOrEqual(10);
    for (const f of users) {
      expect(readFileSync(f, 'utf8'), f).toContain(
        "import { DEFAULT_AI_MODEL } from '@/lib/ai/models';"
      );
    }
  });
});
