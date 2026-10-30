/**
 * #135: apply the signed duplicate merge (owner ruling Dcc), one transaction per group.
 *
 * Why: the dry run (`plan.ts`) only counts; this performs the staged
 * soft-delete merge from Bob's signed decisions, with a ledger for rollback.
 * What: reads the signed dry-run JSON and the decisions file, recomputes the
 * plan in one REPEATABLE READ snapshot, stops on any difference from the
 * signed dry run (A69 exact pinning: group ids, member ids, per-table loser
 * rows exactly, recipe_views within 5%), then applies the phase's groups
 * (`runApply`) with post-checks every `--batch-size` groups. `--dry` runs
 * every group's transaction and rolls it back.
 * Test: `src/lib/recipes/__tests__/dedup-merge-apply.test.ts`
 *
 * Usage (from the project dir; snapshot first, see the step plan):
 *   tm secrets exec --env NEON_API_KEY=NEON.NEON_PAT_BOBMATNYC -- \
 *     pnpm exec tsx scripts/dedup-135/apply.ts --phase 1 --batch-id 135-<stamp> \
 *       --dry-run-file <dry-run>.json --decisions <signed>.json [--dry] [--limit N] [--continue]
 *       [--batch-size 50] (--target prod | --target-url-env STAGING_DATABASE_URL)
 */
import { existsSync, readFileSync } from 'node:fs';
import { DEFAULT_BATCH_SIZE, runApply } from '../../src/lib/recipes/dedup-merge-apply';
import {
  DecisionsError,
  parseDecisions,
  sha256Hex,
  validateDecisions,
} from '../../src/lib/recipes/dedup-merge-decisions';
import { PinError, type PinPlan, type PinReport } from '../../src/lib/recipes/dedup-merge-pin';
import { parseArgs, TARGET_FLAGS, targetChoice } from './args';
import { openWritable } from './connect';

const SPEC = {
  ...TARGET_FLAGS,
  '--phase': 'value',
  '--batch-id': 'value',
  '--dry-run-file': 'value',
  '--decisions': 'value',
  '--limit': 'value',
  '--batch-size': 'value',
  '--dry': 'bool',
  '--continue': 'bool',
} as const;

import { buildPlan } from './plan';

function printPin(d: PinReport): void {
  console.log('\nPin check (signed dry run vs now, post-decision losers):');
  console.log(`  applied before this run: ${d.applied.length}; pending: ${d.pending.size}`);
  for (const r of d.rows) {
    console.log(`  ${r.ok ? 'ok  ' : 'STOP'} ${r.ref}: now ${r.now}, signed ${r.signed}`);
  }
  for (const p of d.problems) console.log(`  problem: ${p}`);
}

// #135: apply entry point; refuses without a signed decisions file and on any pin difference.
async function main(): Promise<number> {
  const a = parseArgs(process.argv.slice(2), SPEC);
  const choice = targetChoice(a, { required: true });
  const phase = Number(a.get('--phase'));
  const batchId = a.get('--batch-id');
  const dryRunFile = a.get('--dry-run-file');
  const decisionsPath = a.get('--decisions');
  if ((phase !== 1 && phase !== 2) || !batchId || !dryRunFile || !decisionsPath) {
    throw new Error(
      'usage: apply.ts --phase 1|2 --batch-id <id> --dry-run-file <json> --decisions <json> [--dry] [--limit N]'
    );
  }
  const signedText = readFileSync(dryRunFile);
  const decisionsText = existsSync(decisionsPath) ? readFileSync(decisionsPath, 'utf8') : undefined;
  const signedPlan = JSON.parse(signedText.toString('utf8')) as PinPlan;
  if (!signedPlan.memberRefs || !signedPlan.memberKeys) {
    console.error(
      'signed dry run has no per-member detail; re-run plan.ts\nstopped: no connection opened'
    );
    return 2;
  }
  const signedPlanSha256 = sha256Hex(signedText);
  // Refuse an unsigned or invalid file before opening any connection.
  try {
    validateDecisions(parseDecisions(decisionsText), signedPlan.groups, signedPlanSha256);
  } catch (err) {
    if (err instanceof DecisionsError) {
      console.error(`${err.message}\nstopped: no connection opened`);
      return 2;
    }
    throw err;
  }
  const { client, target } = await openWritable(choice);
  console.log(
    `target: ${target}; batch ${batchId}; phase ${phase}${a.has('--dry') ? '; DRY (rolled back)' : ''}`
  );
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const recomputedPlan = await buildPlan(client);
    await client.query('COMMIT');
    const out = await runApply(
      client,
      {
        signedPlan,
        signedPlanSha256,
        decisionsText,
        recomputedPlan,
      },
      {
        batchId,
        phase,
        dry: a.has('--dry'),
        continueOnError: a.has('--continue'),
        limit: a.get('--limit') === undefined ? undefined : a.int('--limit', 0),
        batchSize: a.int('--batch-size', DEFAULT_BATCH_SIZE),
      }
    );
    console.log(`decisions signed by ${out.decisions.signed_by} at ${out.decisions.signed_at}`);
    printPin(out.pin);
    console.log('\nGroups:');
    for (const r of out.results) {
      const counts = Object.entries(r.counts)
        .map(([k, n]) => `${k}=${n}`)
        .join(', ');
      console.log(
        `  ${r.groupId} ${r.status}${r.error ? `: ${r.error}` : ''}${counts ? ` (${counts})` : ''}`
      );
    }
    console.log('\nTotals:');
    for (const [k, n] of Object.entries(out.totals).sort()) console.log(`  ${k}: ${n}`);
    if (out.stopped) console.error(`\nstopped: ${out.stopped}`);
    return out.stopped || out.results.some((r) => r.status === 'failed') ? 1 : 0;
  } catch (err) {
    if (err instanceof PinError) {
      printPin(err.report);
      console.error('\nstopped: live data differs from the signed dry run; nothing written');
      return 2;
    }
    if (err instanceof DecisionsError) {
      console.error(`${err.message}\nstopped: nothing written`);
      return 2;
    }
    throw err;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith('apply.ts')) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(`apply failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  );
}
