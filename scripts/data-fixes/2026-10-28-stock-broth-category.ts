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

const PATTERN = String.raw`\m(stocks?|broths?|bouillon|consomm[eé])\M`;

// Rows matched by PATTERN that are not stocks. Fill in after reviewing a dry run.
const ID_DENYLIST: string[] = [];

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
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
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
