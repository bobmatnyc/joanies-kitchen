// @vitest-environment node
/**
 * #138: the root layout's `title.template` ("%s | Joanie's Kitchen") already brands
 * every page title. A page whose own `title` also names the brand shows it twice,
 * e.g. "Lemon Yogurt Cake | Joanie's Kitchen | Joanie's Kitchen".
 *
 * Scans every module under src/app with the TypeScript parser and fails on a
 * segment-level `title` that names the brand. Nested openGraph/twitter titles are not
 * templated by Next, so they may keep it.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { SITE_NAME } from '@/lib/site-title';

const APP_DIR = join(__dirname, '..');
const ROOT_LAYOUT = join(APP_DIR, 'layout.tsx');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

/** `title` properties naming the brand whose object is not nested in another property. */
function brandedSegmentTitles(source: ts.SourceFile): string[] {
  const hits: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === 'title' &&
      node.initializer.getText(source).includes(SITE_NAME) &&
      !ts.isPropertyAssignment(node.parent.parent)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      hits.push(`${relative(APP_DIR, source.fileName)}:${line + 1} ${node.getText(source)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

function parse(path: string, text = readFileSync(path, 'utf8')): ts.SourceFile {
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

describe('page titles name the brand once (#138)', () => {
  it('no segment metadata title repeats the brand the root template adds', () => {
    const files = sourceFiles(APP_DIR).filter((path) => path !== ROOT_LAYOUT);
    expect(files.length).toBeGreaterThan(50);
    expect(files.flatMap((path) => brandedSegmentTitles(parse(path)))).toEqual([]);
  });

  it('flags a branded segment title and ignores a nested openGraph title', () => {
    const path = join(APP_DIR, 'sample.ts');
    const sample = `export const metadata = { title: "X | ${SITE_NAME}", openGraph: { title: "Y | ${SITE_NAME}" } };`;

    expect(brandedSegmentTitles(parse(path, sample))).toEqual([
      `sample.ts:1 title: "X | ${SITE_NAME}"`,
    ]);
  });
});
