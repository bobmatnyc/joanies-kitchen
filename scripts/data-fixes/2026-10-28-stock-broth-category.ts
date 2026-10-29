/**
 * Why: stock/broth ingredient rows carry LLM-assigned categories such as
 *   `dairy` or `proteins` (e.g. "Beef or Chicken Stock" is `dairy`), which
 *   breaks category search. Refs #47.
 * What: sets ingredients.category = 'stocks' for stock/broth/bouillon/consomme
 *   rows. `ingredients.category` is varchar(50) with no enum or check
 *   constraint, so no migration is needed.
 *
 * Modes (default --dry-run):
 *   --dry-run                          print count and matching rows
 *   --backup                           write matching rows (all columns) to
 *                                      /tmp/jk-data-fix-backup-<ts>.json
 *   --apply --expect N --backup-file F update exactly the ids in F, in one
 *                                      transaction, only if the live match
 *                                      count equals N and the backup length
 *   --restore F                        put category and updated_at back from
 *                                      backup F (rows still 'stocks')
 *
 * DATABASE_URL must be set in the environment. Nothing prints it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Client } from 'pg';
import { adminDbUrl } from '../../src/lib/db/admin-db-url';

const PATTERN = String.raw`\m(stocks?|broths?|bouillon|consomm[eé])\M`;

// Owner ruling D6c (#51): move liquid stocks and broths only. Rows matched by
// PATTERN that are dry/concentrated products or not stocks are excluded here.
const ID_DENYLIST: string[] = [
  // Dry or concentrated products
  '1add460b-0870-4e6b-8d0a-5ac21b05cb23', // beef bouillon concentrate
  'b8189256-78a1-40bf-8d5a-3bd2cf57aaf3', // beef bouillon cube
  '4360fadd-7e8d-4e04-a246-5b52276a60e4', // beef bouillon granules
  'a8760589-7c7a-4c0b-ad51-5a995be0d17b', // beef bouillon paste
  '43ce0d4a-973a-4371-8cec-746f10577825', // beef stock concentrate
  '36bb8288-cf8c-4019-95ac-d3b297ddcaf6', // bouillon cube
  'fd553b2f-1a17-40f6-a52b-036ba0158195', // chicken bouillon cube
  '497e6fbd-947a-492b-84ab-90c8811f959c', // chicken stock cube
  'b2de9900-0a8a-4a1f-a793-8b81634f6753', // stock cubes
  'd8004fcf-f59a-4d5a-bd4d-cfa99679e7c6', // vegetable bouillon cube
  'b6182081-e0bf-4640-b77a-628b78a70652', // vegetable bouillon granules
  '1e3babf2-208e-4b40-b2a7-af692136e2f3', // vegetable stock cube
  // Not a stock
  '14f43cd1-a119-438a-9449-a2a6512d7b46', // beef consomme soup
  'f6849777-1e35-4e4e-9031-ac1814102ade', // water or mild stock
  // Ambiguous, excluded: may mean the dry product; owner can add later
  '652e7bb0-90fc-4b7e-9616-222bce747bbb', // beef bouillon
  '7be1693b-3787-4a6a-8119-ab6e5b378414', // bouillon (display: Chicken Bouillon)
  'fffbc9cc-fe06-40d6-80b0-d99725f910ba', // chicken bouillon
];

const MATCH_WHERE = `(name ~* $1 OR display_name ~* $1)
  AND category IS DISTINCT FROM 'stocks'
  AND NOT (id = ANY($2::uuid[]))`;
const MATCH_PARAMS = [PATTERN, ID_DENYLIST];

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (flag: string) => process.argv.includes(flag);

async function main() {
  // D3a: pooled pg_dump broke prod reads; unpooled host only
  const url = adminDbUrl(process.env.DATABASE_URL, 'admin');
  const modes = ['--backup', '--apply', '--restore'].filter(has);
  if (modes.length > 1) throw new Error('choose one of --dry-run, --backup, --apply, --restore');

  const parsed = new URL(url);
  console.log(`DB host=${parsed.hostname} dbname=${parsed.pathname.slice(1)}`);

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    if (has('--apply')) {
      await apply(client);
    } else if (has('--restore')) {
      await restore(client);
    } else if (has('--backup')) {
      const { rows } = await client.query(
        `SELECT * FROM ingredients WHERE ${MATCH_WHERE} ORDER BY name`,
        MATCH_PARAMS
      );
      const file = `/tmp/jk-data-fix-backup-${Date.now()}.json`;
      writeFileSync(file, JSON.stringify(rows, null, 2), { mode: 0o600, flag: 'wx' });
      console.log(`backed up ${rows.length} rows to ${file}`);
      console.log('Copy this file somewhere durable; /tmp is cleared on reboot.');
    } else {
      const { rows } = await client.query(
        `SELECT id, name, display_name, category FROM ingredients
         WHERE ${MATCH_WHERE} ORDER BY category NULLS FIRST, name`,
        MATCH_PARAMS
      );
      console.log(`DRY RUN: ${rows.length} rows would change to category 'stocks'`);
      for (const r of rows) {
        console.log(`${r.id}\t${r.name}\t${r.display_name}\t${r.category}`);
      }
    }
  } finally {
    await client.end();
  }
}

async function apply(client: Client) {
  const expect = Number(arg('--expect'));
  const file = arg('--backup-file');
  if (!Number.isInteger(expect) || !file) {
    throw new Error('--apply requires --expect N and --backup-file <path>');
  }
  const ids: string[] = JSON.parse(readFileSync(file, 'utf8')).map((r: { id: string }) => r.id);
  if (ids.length !== expect) {
    throw new Error(`backup has ${ids.length} ids, --expect is ${expect}`);
  }
  await client.query('BEGIN');
  try {
    const live = await client.query(
      `SELECT count(*)::int AS n FROM ingredients WHERE ${MATCH_WHERE}`,
      MATCH_PARAMS
    );
    const before = await client.query(
      `SELECT count(*)::int AS n FROM ingredients WHERE category = 'stocks'`
    );
    if (live.rows[0].n !== expect) {
      throw new Error(`live match count ${live.rows[0].n} != --expect ${expect}`);
    }
    // rowCount === expect forces the backup set to equal the live match set.
    const upd = await client.query(
      `UPDATE ingredients SET category = 'stocks', updated_at = now()
       WHERE id = ANY($3::uuid[]) AND ${MATCH_WHERE}`,
      [...MATCH_PARAMS, ids]
    );
    if (upd.rowCount !== expect) {
      throw new Error(`updated ${upd.rowCount} rows, expected ${expect}`);
    }
    const after = await client.query(
      `SELECT count(*)::int AS n FROM ingredients WHERE category = 'stocks'`
    );
    const remaining = await client.query(
      `SELECT count(*)::int AS n FROM ingredients WHERE ${MATCH_WHERE}`,
      MATCH_PARAMS
    );
    if (remaining.rows[0].n !== 0) {
      throw new Error(`${remaining.rows[0].n} rows still match after update`);
    }
    await client.query('COMMIT');
    console.log(`stocks rows before: ${before.rows[0].n}, after: ${after.rows[0].n}`);
    console.log(`matched before: ${live.rows[0].n}, after: ${remaining.rows[0].n}`);
  } catch (err) {
    await rollback(client);
    throw err;
  }
}

async function rollback(client: Client) {
  try {
    await client.query('ROLLBACK');
  } catch (e) {
    console.error('ROLLBACK failed:', e instanceof Error ? e.message : e);
  }
}

// Restores category and updated_at from the backup for rows still 'stocks'.
async function restore(client: Client) {
  const file = arg('--restore');
  if (!file) throw new Error('--restore requires a backup file path');
  const json = readFileSync(file, 'utf8');
  await client.query('BEGIN');
  try {
    const res = await client.query(
      `UPDATE ingredients i SET category = b.category, updated_at = b.updated_at
       FROM json_populate_recordset(null::ingredients, $1::json) b
       WHERE i.id = b.id AND i.category = 'stocks'`,
      [json]
    );
    await client.query('COMMIT');
    console.log(`restored ${res.rowCount} rows from ${file}`);
  } catch (err) {
    await rollback(client);
    throw err;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
