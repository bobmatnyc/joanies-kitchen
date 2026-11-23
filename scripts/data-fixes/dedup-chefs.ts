/**
 * Why: duplicate chef rows split one person's recipes across several ids. The
 * owner decides which rows merge in a plan file; this script carries it out.
 * What: reads the plan JSON, validates it against the database, prints per
 * group the names, links moved, conflicts skipped and resulting recipe_count;
 * with --apply runs every write in ONE transaction, each statement row-counted,
 * and rolls the whole run back on any mismatch. Logic: `src/lib/chef-dedup.ts`.
 * Test: `src/lib/__tests__/chef-dedup.test.ts`
 *
 * Plan shape:
 *   { "merges": [{ "survivor": id, "losers": [id...], "rename"?: { "name", "slug" } }],
 *     "reattribute": [{ "chef": id, "to": id }],
 *     "unlinkAndDelete": [id...] }
 *
 * Modes (default --dry-run):
 *   --dry-run   validate and print the plan; write nothing
 *   --apply     write everything in one transaction
 *
 * DATABASE_URL must be set in the environment. Nothing prints it.
 * Usage: npx tsx scripts/data-fixes/dedup-chefs.ts <plan.json> [--apply]
 */
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import {
  applyDedupPlan,
  computeDedupPlan,
  parseDedupPlan,
  type Querier,
  renderDedupPlan,
} from '../../src/lib/chef-dedup';

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const unknown = args.filter((a) => a.startsWith('--') && a !== '--apply' && a !== '--dry-run');
  const positional = args.filter((a) => !a.startsWith('--'));
  if (unknown.length > 0 || positional.length !== 1) {
    console.error('usage: dedup-chefs.ts <plan.json> [--apply]');
    process.exit(2);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(2);
  }
  const plan = parseDedupPlan(JSON.parse(readFileSync(positional[0], 'utf8')));

  const client = new Client({ connectionString: url });
  await client.connect();
  const q: Querier = {
    query: async (sql, params) => {
      const res = await client.query(sql, params);
      return { rows: res.rows, rowCount: res.rowCount ?? 0 };
    },
  };
  try {
    let host = '(unparsable URL)';
    try {
      host = new URL(url).hostname;
    } catch {
      // Keep the placeholder; never print the URL itself.
    }
    console.log(`mode: ${apply ? 'APPLY' : 'dry-run'}; host: ${host}`);
    const computed = apply ? await applyDedupPlan(q, plan) : await computeDedupPlan(q, plan);
    for (const line of renderDedupPlan(computed)) console.log(line);
    if (!apply) {
      console.log('dry-run: nothing written. Re-run with --apply to write.');
      return;
    }
    console.log(
      `committed: ${computed.moves.length} chefs merged/reattributed, ${computed.unlinks.length} unlinked and deleted`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
