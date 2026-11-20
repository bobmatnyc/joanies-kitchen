/**
 * Why: chef discovery stored raw scraped About-page text (navigation, social
 *   links, promos) as chef bios when no LLM summary was available — e.g. chef
 *   Anja Eckert. The discovery path now uses `cleanScrapedBio`; this script
 *   repairs rows written before that fix.
 * What: finds chefs whose bio `bioNeedsRepair` flags and sets each to
 *   `cleanScrapedBio(bio)`, or NULL when no prose survives.
 *
 * Modes (default --dry-run):
 *   --dry-run   list chef name, id, old bio prefix and new bio; write nothing
 *   --apply     write the new bios in one transaction
 *
 * DATABASE_URL must be set in the environment. Nothing prints it.
 * Usage: npx tsx scripts/data-fixes/repair-chef-bios.ts [--apply]
 */
import { Client } from 'pg';
import { bioNeedsRepair, cleanScrapedBio } from '../../src/lib/chef-bio-cleaner';

const PREFIX_LENGTH = 80;

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(2);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string; name: string; bio: string }>(
      `SELECT id, name, bio FROM chefs WHERE bio IS NOT NULL AND btrim(bio) <> '' ORDER BY name`
    );
    const fixes = rows
      .filter((r) => bioNeedsRepair(r.bio))
      .map((r) => ({ ...r, newBio: cleanScrapedBio(r.bio) }));

    console.log(`mode: ${apply ? 'APPLY' : 'dry-run'}`);
    console.log(`chefs with a bio: ${rows.length}; flagged: ${fixes.length}`);
    for (const f of fixes) {
      console.log('---');
      console.log(`name:    ${f.name}`);
      console.log(`id:      ${f.id}`);
      console.log(`old bio: ${JSON.stringify(f.bio.slice(0, PREFIX_LENGTH))}`);
      console.log(`new bio: ${f.newBio ? JSON.stringify(f.newBio) : '(empty -> NULL)'}`);
    }

    if (!apply) {
      console.log('dry-run: nothing written. Re-run with --apply to write.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const f of fixes) {
        await client.query('UPDATE chefs SET bio = $1, updated_at = now() WHERE id = $2', [
          f.newBio || null,
          f.id,
        ]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log(`updated: ${fixes.length}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
