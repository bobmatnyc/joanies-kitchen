/**
 * #135: reverse a merge batch from `dedup_135_ledger`, newest group first.
 *
 * Why: rollback option A of the step plan only clears `deleted_at`; this
 * moves rows back, re-inserts dropped rows, restores keeper slugs/counters and
 * deletes the batch's redirects, without a snapshot restore.
 * What: `runRollback` per group in its own transaction; `--group` narrows to
 * one group; `--dry` reverses and rolls back. Same host guard as apply.
 * Test: `src/lib/recipes/__tests__/dedup-merge-rollback.test.ts`
 *
 * Usage:
 *   tm secrets exec --env NEON_API_KEY=NEON.NEON_PAT_BOBMATNYC -- \
 *     pnpm exec tsx scripts/dedup-135/rollback.ts --batch-id <id> [--group g-xxxxxxxx] [--dry]
 *       (--target prod | --target-url-env STAGING_DATABASE_URL)
 */
import { runRollback } from '../../src/lib/recipes/dedup-merge-rollback';
import { parseArgs, TARGET_FLAGS, targetChoice } from './args';
import { openWritable } from './connect';

const SPEC = {
  ...TARGET_FLAGS,
  '--batch-id': 'value',
  '--group': 'value',
  '--dry': 'bool',
} as const;

// #135: rollback entry point for a merge batch.
async function main(): Promise<void> {
  const a = parseArgs(process.argv.slice(2), SPEC);
  const choice = targetChoice(a, { required: true });
  const batchId = a.get('--batch-id');
  if (!batchId) throw new Error('usage: rollback.ts --batch-id <id> [--group <group id>] [--dry]');
  const { client, target } = await openWritable(choice);
  console.log(`target: ${target}; batch ${batchId}${a.has('--dry') ? '; DRY (rolled back)' : ''}`);
  try {
    const results = await runRollback(client, {
      batchId,
      groupId: a.get('--group'),
      dry: a.has('--dry'),
    });
    const totals: Record<string, number> = {};
    for (const r of results) {
      const counts = Object.entries(r.reversed)
        .map(([k, n]) => `${k}=${n}`)
        .join(', ');
      console.log(`  ${r.groupId}: ${counts}`);
      for (const [k, n] of Object.entries(r.reversed)) totals[k] = (totals[k] ?? 0) + n;
    }
    console.log(`groups reversed: ${results.length}`);
    for (const [k, n] of Object.entries(totals).sort()) console.log(`  ${k}: ${n}`);
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith('rollback.ts')) {
  main().catch((err: unknown) => {
    console.error(`rollback failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
