/**
 * #135: read-only dry run of the duplicate-recipe merge. No apply mode.
 *
 * Why: the owner must see exact counts (groups, losers, rows to re-point,
 * unique-key collisions, redirects, review list) before ruling on decision Dcc.
 * What: recomputes the duplicate groups from the live database with the
 * report's title key, picks keepers with `selectKeeper`, and counts every
 * reference a merge would move. Writes `<out>.json` and `<out>.md`.
 * Test: `src/lib/recipes/__tests__/dedup-merge-plan.test.ts` (pure rules).
 *
 * Safety: the host must match the anchored prod regex (unpooled host only);
 * the session runs `SET SESSION default_transaction_read_only = on` and must
 * report `transaction_read_only = on` before any other query; every query
 * then runs inside one READ ONLY transaction that is rolled back, and the
 * query helper refuses any statement that is not SELECT/WITH/SHOW.
 *
 * Usage (from the project dir):
 *   tm secrets exec --env NEON_API_KEY=NEON.NEON_PAT_BOBMATNYC -- \
 *     pnpm exec tsx scripts/dedup-135/plan.ts --out <path-without-extension>
 * With NEON_API_KEY set the connection string comes from the Neon API;
 * otherwise from DATABASE_URL. Nothing prints it.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { Client } from 'pg';
import { assertProdHost, assertUnpooledHost } from '../../src/lib/db/admin-db-url';
import {
  discoverAllRefs,
  discoverRecipeRefs,
  isBackupTable,
  keyRefName,
  MERGE_BOOKKEEPING,
  otherKeySql,
  type Queryable,
} from '../../src/lib/recipes/dedup-merge-db';
import { expectedCollisions, type MemberDetail } from '../../src/lib/recipes/dedup-merge-pin';
import {
  categorizeGroup,
  countRepointCollisions,
  type GroupCategory,
  type GroupMember,
  type KeyedRow,
  needsReview,
  selectKeeper,
  titleKeySql,
} from '../../src/lib/recipes/dedup-merge-plan';
import { parseArgs } from './args';
import { type Plan, renderMarkdown } from './render';

const NEON_PROJECT = 'autumn-forest-97440143';
const NEON_BRANCH = 'br-super-hall-adskawq1';
const NEON_ENDPOINT = 'ep-jolly-snow-addxski4';

/** Report §6/§7: the rows that count as user references in the keeper rule. */
const USER_REF_TABLES = [
  'favorites',
  'collection_recipes',
  'meal_recipes',
  'recipe_ratings',
  'recipe_comments',
  'joanie_comments',
  'recipe_likes',
];
/** Report §7: the keeper keeps its own; the loser's stay attached to the soft-deleted loser. */
const STAY_WITH_LOSER = new Set(['recipe_embeddings', 'recipe_ingredients']);

const READ_ONLY_SQL = /^\s*(select|with|show)\b/i;
const WRITE_WORDS =
  /\b(insert|update|delete|truncate|alter|drop|create|grant|revoke|merge|copy|vacuum|call|do)\b/i;

/** Every data query goes through here; anything but a read is refused before it is sent. */
async function q<T extends Record<string, unknown>>(
  client: Queryable,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!READ_ONLY_SQL.test(sql) || WRITE_WORDS.test(sql)) {
    throw new Error('refusing a non-read statement (dry run is read-only)');
  }
  return (await client.query(sql, params)).rows as T[];
}

const ident = (s: string): string => `"${s.replace(/"/g, '""')}"`;

export async function resolveConnectionString(): Promise<string> {
  const key = process.env.NEON_API_KEY;
  if (!key) {
    if (!process.env.DATABASE_URL) throw new Error('set NEON_API_KEY or DATABASE_URL');
    return process.env.DATABASE_URL;
  }
  const qs = new URLSearchParams({
    branch_id: NEON_BRANCH,
    endpoint_id: NEON_ENDPOINT,
    database_name: 'neondb',
    role_name: 'neondb_owner',
    pooled: 'false',
  });
  const res = await fetch(
    `https://console.neon.tech/api/v2/projects/${NEON_PROJECT}/connection_uri?${qs}`,
    { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(`Neon API connection_uri returned HTTP ${res.status}`);
  const uri = ((await res.json()) as { uri?: string }).uri;
  if (!uri) throw new Error('Neon API response had no uri');
  return uri;
}

async function openReadOnly(): Promise<Client> {
  const url = await resolveConnectionString();
  // #135: unpooled prod host only; both throw without echoing the string.
  assertUnpooledHost(url, 'admin');
  assertProdHost(url);
  console.log(
    `host check: ${new URL(url).hostname.split('.')[0]} matches ^ep-jolly-snow-addxski4\\.`
  );
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('SET SESSION default_transaction_read_only = on');
  const ro = (await client.query('SHOW transaction_read_only')).rows[0]?.transaction_read_only;
  console.log(`read-only assertion: SHOW transaction_read_only = ${ro}`);
  if (ro !== 'on') {
    await client.end();
    throw new Error('session is not read-only; refusing to run');
  }
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  return client;
}

type MemberRow = {
  key: string;
  pub: boolean;
  id: string;
  name: string;
  slug: string | null;
  user_id: string | null;
  source: string | null;
  created_at: string;
  ing: string;
  ins: string;
};

async function countBy(client: Queryable, table: string, col: string, ids: string[]) {
  const rows = await q<{ rid: string; n: number }>(
    client,
    `SELECT ${ident(col)}::text AS rid, count(*)::int AS n FROM ${table}
     WHERE ${ident(col)}::text = ANY($1::text[]) GROUP BY 1`,
    [ids]
  );
  return new Map(rows.map((r) => [r.rid, r.n]));
}

async function tableExists(client: Queryable, table: string): Promise<boolean> {
  const [r] = await q<{ t: string | null }>(client, 'SELECT to_regclass($1)::text AS t', [
    `public.${table}`,
  ]);
  return r.t !== null;
}

export interface Group {
  groupId: string;
  key: string;
  isPublic: boolean;
  category: GroupCategory;
  needsReview: boolean;
  keeperId: string;
  reason: string;
  members: Array<Omit<GroupMember, 'createdAt'> & { createdAt: string }>;
}

async function loadGroups(client: Queryable): Promise<Group[]> {
  const rows = await q<MemberRow>(
    client,
    `WITH k AS (
       SELECT id, ${titleKeySql('name')} AS key, coalesce(is_public, false) AS pub
       FROM recipes WHERE deleted_at IS NULL),
     g AS (SELECT key, pub FROM k WHERE key <> '' GROUP BY key, pub HAVING count(*) > 1)
     SELECT k.key, k.pub, r.id, r.name, r.slug, r.user_id, r.source,
       to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
       md5(r.ingredients) AS ing, md5(r.instructions) AS ins
     FROM k JOIN g USING (key, pub) JOIN recipes r ON r.id = k.id
     ORDER BY k.key, k.pub, r.created_at, r.id`
  );
  const ids = rows.map((r) => r.id);
  const views = await countBy(client, 'recipe_views', 'recipe_id', ids);
  const refs = new Map<string, number>();
  for (const t of USER_REF_TABLES) {
    if (!(await tableExists(client, t))) continue;
    for (const [id, n] of await countBy(client, t, 'recipe_id', ids)) {
      refs.set(id, (refs.get(id) ?? 0) + n);
    }
  }
  const byKey = new Map<string, GroupMember[]>();
  for (const r of rows) {
    const gk = `${r.pub}|${r.key}`;
    const list = byKey.get(gk) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      slug: r.slug,
      userId: r.user_id,
      source: r.source,
      createdAt: new Date(r.created_at),
      views: views.get(r.id) ?? 0,
      userRefs: refs.get(r.id) ?? 0,
      ingredientsHash: r.ing,
      instructionsHash: r.ins,
    });
    byKey.set(gk, list);
  }
  return [...byKey.entries()].map(([gk, members]) => {
    const [pub, key] = [gk.startsWith('true|'), gk.slice(gk.indexOf('|') + 1)];
    const category = categorizeGroup(members);
    const { keeperId, reason } = selectKeeper(members);
    return {
      groupId: `g-${createHash('sha1').update(gk).digest('hex').slice(0, 8)}`,
      key,
      isPublic: pub,
      category,
      needsReview: needsReview(category, members.length),
      keeperId,
      reason,
      members: members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    };
  });
}

export interface TableCount {
  table: string;
  column: string;
  onDelete: string;
  loserRows: number;
  handling: string;
  uniqueKeys: Array<{ name: string; columns: string[]; partial: boolean; collisions: number }>;
}

const ON_DELETE: Record<string, string> = {
  a: 'no action',
  r: 'restrict',
  c: 'cascade',
  n: 'set null',
  d: 'set default',
};

async function countDependents(
  client: Queryable,
  keeperOf: Map<string, string>
): Promise<{ fk: TableCount[]; unlinked: TableCount[] }> {
  const losers = [...keeperOf.keys()];
  const involved = [...new Set([...losers, ...keeperOf.values()])];
  const fks = await q<{ tbl: string; col: string; del: string }>(
    client,
    `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.confdeltype AS del
     FROM pg_constraint c
     JOIN LATERAL unnest(c.conkey) AS u(attnum) ON true
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
     WHERE c.contype = 'f' AND c.confrelid = 'public.recipes'::regclass
     ORDER BY 1, 2`
  );
  const fk: TableCount[] = [];
  for (const { tbl, col, del } of fks) {
    const loserRows = [...(await countBy(client, tbl, col, losers)).values()].reduce(
      (a, b) => a + b,
      0
    );
    const uniques = await q<{ name: string; cols: string[]; partial: boolean }>(
      client,
      `SELECT i.indexrelid::regclass::text AS name, i.indpred IS NOT NULL AS partial,
         array_agg(a.attname::text ORDER BY k.ord) AS cols
       FROM pg_index i
       JOIN LATERAL unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord) ON true
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
       WHERE i.indrelid = $1::regclass AND i.indisunique AND NOT (0 = ANY(i.indkey::int2[]))
       GROUP BY 1, 2`,
      [tbl]
    );
    const uniqueKeys = [];
    for (const u of uniques.filter((x) => x.cols.includes(col))) {
      const others = u.cols.filter((c) => c !== col);
      const sel = others.map((c, i) => `${ident(c)}::text AS o${i}`).join(', ');
      const rows = await q<Record<string, string | null>>(
        client,
        `SELECT ${ident(col)}::text AS rid${sel ? `, ${sel}` : ''} FROM ${tbl}
         WHERE ${ident(col)}::text = ANY($1::text[]) ORDER BY 1`,
        [involved]
      );
      const keyed: KeyedRow[] = rows.map((r) => ({
        recipeId: r.rid as string,
        otherKey: others.map((_, i) => r[`o${i}`] ?? null),
      }));
      const { collisions } = countRepointCollisions(keyed, keeperOf);
      uniqueKeys.push({ name: u.name, columns: u.cols, partial: u.partial, collisions });
    }
    const handling = STAY_WITH_LOSER.has(tbl)
      ? "not moved: keeper keeps its own; loser's rows stay on the soft-deleted loser"
      : uniqueKeys.some((u) => u.collisions > 0)
        ? "re-point; on collision drop the loser's row and keep the keeper's"
        : uniqueKeys.length > 0
          ? 're-point (unique key, no collisions today)'
          : 'plain re-point';
    fk.push({
      table: tbl,
      column: col,
      onDelete: ON_DELETE[del] ?? del,
      loserRows,
      handling,
      uniqueKeys,
    });
  }
  // Columns named like a recipe id that carry no FK (report §6: recipe_discovery_run_items).
  const fkSet = new Set(fks.map((f) => `${f.tbl}.${f.col}`));
  const cols = await q<{ tbl: string; col: string }>(
    client,
    `SELECT table_name::text AS tbl, column_name::text AS col FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name ~ 'recipe_id$' AND table_name <> 'recipes'
     ORDER BY 1, 2`
  );
  const unlinked: TableCount[] = [];
  // #135: the merge's own ledger and redirect source columns are not data to move.
  const isData = (c: { tbl: string; col: string }) =>
    !fkSet.has(`${c.tbl}.${c.col}`) && !MERGE_BOOKKEEPING.has(`${c.tbl}.${c.col}`);
  for (const { tbl, col } of cols.filter(isData)) {
    const loserRows = [...(await countBy(client, tbl, col, losers)).values()].reduce(
      (a, b) => a + b,
      0
    );
    unlinked.push({
      table: tbl,
      column: col,
      onDelete: 'no FK',
      loserRows,
      // #135 (A69): a backup table is never re-pointed.
      handling: isBackupTable(tbl)
        ? 'not moved: backup table; apply records each loser row as a ledger note'
        : 'text reference: re-point in the same transaction',
      uniqueKeys: [],
    });
  }
  return { fk, unlinked };
}

/** Every query of `fn` goes through the read-only guard `q`. */
const guarded = (client: Queryable): Queryable => ({
  query: async <T>(sql: string, params: unknown[] = []) => ({
    rows: (await q(client, sql, params)) as T[],
  }),
});

/**
 * #135 (A69): per-member detail the apply pins against: rows per recipe
 * column, and each unique-keyed row's other key values (chef_id for
 * chef_recipes). Read-only, through `q`.
 */
async function loadMemberDetail(client: Queryable, groups: Group[]): Promise<MemberDetail> {
  const ids = groups.flatMap((g) => g.members.map((m) => m.id));
  const memberRefs: MemberDetail['memberRefs'] = {};
  const memberKeys: MemberDetail['memberKeys'] = {};
  // Counts cover every recipe column (embeddings, ingredients and backups too, for the record);
  // unique-key values only the columns the apply moves.
  const all = await discoverAllRefs(guarded(client));
  const movedNames = new Set(
    (await discoverRecipeRefs(guarded(client))).map((r) => `${r.table}.${r.column}`)
  );
  for (const ref of all) {
    const name = `${ref.table}.${ref.column}`;
    for (const [id, n] of await countBy(client, ref.table, ref.column, ids)) {
      memberRefs[id] = { ...memberRefs[id], [name]: n };
    }
    if (!movedNames.has(name)) continue;
    for (const key of ref.uniqueKeys.filter((k) => !k.partial)) {
      const others = key.columns.filter((c) => c !== ref.column);
      const rows = await q<{ rid: string; k: string }>(
        client,
        `SELECT x.${ident(ref.column)}::text AS rid, ${otherKeySql(others, 'x')} AS k
         FROM ${ident(ref.table)} x WHERE x.${ident(ref.column)}::text = ANY($1::text[])
         ORDER BY 1, 2`,
        [ids]
      );
      const kname = keyRefName(ref.table, ref.column, key.name);
      for (const row of rows) {
        const forMember = memberKeys[row.rid] ?? {};
        forMember[kname] = [...(forMember[kname] ?? []), row.k];
        memberKeys[row.rid] = forMember;
      }
    }
  }
  return { memberRefs, memberKeys };
}

/**
 * Rules-only collisions on one recipe column as (other key, loser, survivor)
 * triples, for the record: chef_recipes (chef_id) and recipe_tools (tool_id).
 */
function collisionTriples(groups: Group[], detail: MemberDetail, refPrefix: string) {
  return groups.flatMap((g) => {
    const losers = g.members.map((m) => m.id).filter((id) => id !== g.keeperId);
    return expectedCollisions(g.keeperId, losers, detail.memberKeys)
      .filter((c) => c.ref.startsWith(refPrefix))
      .map((c) => ({
        groupId: g.groupId,
        otherId: (JSON.parse(c.key) as string[])[0] ?? '',
        loserId: c.loserId,
        survivorId: c.survivorId,
      }));
  });
}

const chefCollisions = (groups: Group[], detail: MemberDetail): Plan['chefCollisions'] =>
  collisionTriples(groups, detail, 'chef_recipes.recipe_id#').map(({ otherId, ...c }) => ({
    ...c,
    chefId: otherId,
  }));

// #135 (rehearsal): recipe_tools drops, pinned like the chef triples.
const toolCollisions = (groups: Group[], detail: MemberDetail): Plan['toolCollisions'] =>
  collisionTriples(groups, detail, 'recipe_tools.recipe_id#').map(({ otherId, ...c }) => ({
    ...c,
    toolId: otherId,
  }));

/** Reads everything the plan needs. Exported so the SQL can be checked against a local database. */
export async function buildPlan(client: Queryable): Promise<Plan> {
  const [baseline] = await q<Plan['baseline']>(
    client,
    `SELECT count(*)::int AS total, count(deleted_at)::int AS deleted,
       count(*) FILTER (WHERE is_public)::int AS public FROM recipes`
  );
  const groups = await loadGroups(client);
  const keeperOf = new Map<string, string>();
  for (const g of groups) {
    for (const m of g.members) if (m.id !== g.keeperId) keeperOf.set(m.id, g.keeperId);
  }
  const losers = [...keeperOf.keys()];
  const dependents = await countDependents(client, keeperOf);
  const rotd = (await tableExists(client, 'recipe_of_the_day'))
    ? await q<{ row: Record<string, unknown> }>(
        client,
        `SELECT to_jsonb(t) AS row FROM recipe_of_the_day t
         WHERE recipe_id::text = ANY($1::text[]) ORDER BY t.date`,
        [losers]
      )
    : [];
  const discovery = (await tableExists(client, 'recipe_discovery_run_items'))
    ? await q<{ row: Record<string, unknown> }>(
        client,
        `SELECT jsonb_build_object('id', t.id, 'run_id', t.run_id, 'recipe_id', t.recipe_id,
           'outcome', t.outcome) AS row
         FROM recipe_discovery_run_items t WHERE recipe_id::text = ANY($1::text[])`,
        [losers]
      )
    : [];
  const detail = await loadMemberDetail(client, groups);
  return {
    generatedAt: new Date().toISOString(),
    baseline,
    groups,
    dependents,
    ...detail,
    chefCollisions: chefCollisions(groups, detail),
    toolCollisions: toolCollisions(groups, detail),
    recipeOfTheDay: rotd.map((r) => r.row),
    discoveryRunItems: discovery.map((r) => r.row),
  };
}

// #135: read-only dry run for the duplicate merge (decision Dcc pending); no apply mode.
async function main() {
  const args = parseArgs(process.argv.slice(2), { '--out': 'value', '--apply': 'bool' });
  const out = args.get('--out');
  if (!out) throw new Error('usage: plan.ts --out <path-without-extension>');
  if (args.has('--apply')) throw new Error('#135: this script has no apply mode');
  const client = await openReadOnly();
  try {
    const plan = await buildPlan(client);
    writeFileSync(`${out}.json`, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600 });
    writeFileSync(`${out}.md`, renderMarkdown(plan), { mode: 0o600 });
    console.log(`wrote ${out}.json and ${out}.md`);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}

if (process.argv[1]?.endsWith('plan.ts')) {
  main().catch((err: unknown) => {
    // Error text from pg or this script never carries the connection string.
    console.error(`dry run failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
