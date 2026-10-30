/**
 * #135 (A69 gap 1): read-only row counts and checksums for the rollback rehearsal.
 *
 * Why: the rehearsal (Neon branch of prod: checksum, apply both phases,
 * rollback, checksum) passes only when the two outputs diff clean, apart
 * from the ledger, which keeps its rows marked `rolled_back_at`.
 * What: opens a read-only session (same assertion as `plan.ts`), lists the
 * tables the apply touches and prints JSON with each table's row count and
 * order-independent md5 (`tableChecksums`). Same host guard as apply.
 * Test: `src/lib/recipes/__tests__/dedup-merge-checksum.test.ts`
 *
 * Usage:
 *   pnpm exec tsx scripts/dedup-135/checksum.ts --target-url-env REHEARSAL_DATABASE_URL --out before.json
 *   (no --target-url-env: the unpooled prod host via NEON_API_KEY, read-only)
 */
import { writeFileSync } from 'node:fs';
import { tableChecksums, touchedTables } from '../../src/lib/recipes/dedup-merge-checksum';
import { parseArgs, TARGET_FLAGS, targetChoice } from './args';
import { openReadOnlyTarget } from './connect';

const SPEC = { ...TARGET_FLAGS, '--out': 'value' } as const;

// #135: rehearsal checksum entry point; read-only.
async function main(): Promise<void> {
  const a = parseArgs(process.argv.slice(2), SPEC);
  const out = a.get('--out');
  // Read-only: no target flag means prod, behind the same anchored host check.
  const { client, target } = await openReadOnlyTarget(targetChoice(a, { required: false }));
  try {
    const tables = await tableChecksums(client, await touchedTables(client));
    const text = `${JSON.stringify({ generatedAt: new Date().toISOString(), target, tables }, null, 2)}\n`;
    if (out) {
      writeFileSync(out, text, { mode: 0o600 });
      console.error(`wrote ${out} (${tables.length} tables)`);
    } else process.stdout.write(text);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}

if (process.argv[1]?.endsWith('checksum.ts')) {
  main().catch((err: unknown) => {
    console.error(`checksum failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
