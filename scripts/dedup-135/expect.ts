/**
 * #135 (A69): offline check that the apply's own expectations reproduce the
 * prod-read expected counts. No database connection.
 *
 * Why: the rehearsal compares against `2026-10-30-135-expected-counts.json`;
 * the apply derives its expectations from the signed dry run and decisions.
 * The two must agree before anything runs.
 * What: validates the decisions file against the dry-run JSON (signature,
 * hash, groups, acks), computes `expectFromSigned`, prints it as JSON, and
 * with `--compare` lists every figure side by side. Exit 1 on any mismatch,
 * 2 on an invalid decisions file. A figure the dry run cannot support is
 * reported as not derivable, never as a match.
 * Test: `src/lib/recipes/__tests__/dedup-merge-expect.test.ts`
 *
 * Usage:
 *   pnpm exec tsx scripts/dedup-135/expect.ts --dry-run-file <dry-run>.json \
 *     --decisions <signed>.json [--compare <expected-counts>.json]
 */
import { readFileSync } from 'node:fs';
import {
  DecisionsError,
  parseDecisions,
  resolveGroups,
  sha256Hex,
  validateDecisions,
} from '../../src/lib/recipes/dedup-merge-decisions';
import {
  type Expectations,
  type ExpectPlan,
  expectFromSigned,
} from '../../src/lib/recipes/dedup-merge-expect';
import { parseArgs } from './args';

const SPEC = { '--dry-run-file': 'value', '--decisions': 'value', '--compare': 'value' } as const;

type Json = Record<string, unknown>;
const at = (o: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Json)[k] : undefined), o);

/** [label, ours (null = not derivable), theirs] for every figure in the expected-counts file. */
export function comparisons(e: Expectations, x: Json): Array<[string, number | null, unknown]> {
  const rows: Array<[string, number | null, unknown]> = [
    ['losers', e.losers, at(x, 'basis', 'losers')],
    ['losers phase 1', e.losersPhase1, at(x, 'basis', 'losers_phase1')],
    ['losers phase 2', e.losersPhase2, at(x, 'basis', 'losers_phase2')],
    ['groups with losers', e.groupsWithLosers, at(x, 'basis', 'groups_with_losers')],
    ['soft-deleted after apply', e.softDeleted, at(x, 'post_apply', 'soft_deleted')],
    ['live after apply', e.liveAfter, at(x, 'post_apply', 'live_expected')],
    ['redirects by id', e.redirectsById, at(x, 'redirects', 'by_id')],
    ['redirects by slug', e.redirectsBySlug, at(x, 'redirects', 'by_slug')],
    ['survivors with NULL slug', e.keepersNullSlug, at(x, 'redirects', 'keepers_with_null_slug')],
    [
      'recipe_views (member views)',
      e.views,
      at(x, 'tables', 'recipe_views.recipe_id', 'loser_rows'),
    ],
    ['recipe_of_the_day (row list)', e.recipeOfTheDay, at(x, 'recipe_of_the_day', 'count')],
    [
      'discovery items (row list)',
      e.discoveryRunItems,
      at(x, 'recipe_discovery_run_items', 'count'),
    ],
  ];
  const tables = (at(x, 'tables') ?? {}) as Record<string, Json>;
  for (const [ref, t] of Object.entries(tables)) {
    rows.push([`${ref} loser rows`, e.tables ? (e.tables[ref] ?? 0) : null, t.loser_rows]);
  }
  rows.push(['chef_recipes collisions', e.chefCollisions, at(x, 'chef_recipes', 'collisions')]);
  // #135 (rehearsal): recipe_tools drops on the logical key (recipe_id, tool_id).
  rows.push([
    'recipe_tools collisions',
    e.toolCollisions,
    at(x, 'recipe_tools', 'collisions') ??
      at(x, 'tables', 'recipe_tools.recipe_id', 'collisions_dropped'),
  ]);
  return rows;
}

// #135: offline expectations check; reads two or three local files, no connection.
function main(): number {
  const a = parseArgs(process.argv.slice(2), SPEC);
  const dryRunFile = a.get('--dry-run-file');
  const decisionsPath = a.get('--decisions');
  const compare = a.get('--compare');
  if (!dryRunFile || !decisionsPath) {
    throw new Error('usage: expect.ts --dry-run-file <json> --decisions <json> [--compare <json>]');
  }
  const bytes = readFileSync(dryRunFile);
  const plan = JSON.parse(bytes.toString('utf8')) as ExpectPlan;
  let resolved: ReturnType<typeof resolveGroups>;
  try {
    const raw = parseDecisions(readFileSync(decisionsPath, 'utf8'));
    resolved = resolveGroups(plan.groups, validateDecisions(raw, plan.groups, sha256Hex(bytes)));
  } catch (err) {
    if (err instanceof DecisionsError) {
      console.error(err.message);
      return 2;
    }
    throw err;
  }
  const e = expectFromSigned(plan, resolved);
  if (!compare) {
    console.log(JSON.stringify(e, null, 2));
    return 0;
  }
  const x = JSON.parse(readFileSync(compare, 'utf8')) as Json;
  let mismatch = 0;
  for (const [label, ours, theirs] of comparisons(e, x)) {
    const verdict = ours === null ? 'NOT DERIVABLE' : ours === theirs ? 'match' : 'MISMATCH';
    if (verdict === 'MISMATCH') mismatch++;
    console.log(
      `${verdict.padEnd(13)} ${label}: apply ${ours ?? '-'}, expected-counts ${String(theirs)}`
    );
  }
  for (const n of e.notDerivable) console.log(`note: ${n}`);
  console.log(`mismatches: ${mismatch}`);
  return mismatch > 0 ? 1 : 0;
}

if (process.argv[1]?.endsWith('expect.ts')) {
  try {
    process.exit(main());
  } catch (err) {
    console.error(`expect failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
