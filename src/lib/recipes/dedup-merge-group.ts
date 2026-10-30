/**
 * #135: one group of the duplicate merge, inside the caller's transaction.
 *
 * Why: every change of a group must commit or roll back together, and each
 * one is ledgered in the same transaction so rollback can undo it exactly.
 * What: steps 1-8 of the step plan plus the A69 additions: step-1 assertions
 * (survivor owner, recipe_ingredients counts), backup-table notes, collisions
 * pinned to the signed set, parent counters, `source_override`.
 * Test: `src/lib/recipes/__tests__/dedup-merge-apply.test.ts`
 */
import { generateUniqueSlug } from '@/lib/utils/slug';
import {
  ident,
  keyRefName,
  otherKeySql,
  pkJsonSql,
  type Queryable,
  type RecipeRef,
} from './dedup-merge-db';
import type { ResolvedGroup } from './dedup-merge-decisions';
import type { Collision, MemberDetail } from './dedup-merge-pin';

export const LEDGER_COLS =
  'batch_id, group_id, kind, table_name, column_name, row_pk, old_recipe_id, new_recipe_id, row_data';

/** A69 change 2: a survivor must be owned by one of these. */
export const SYSTEM_OWNERS = ['system', 'system_imported'];

/** Parent counters recounted from live child rows, as the app's recount helpers do. */
export const PARENT_COUNTERS = [
  // src/lib/chef-recipe-count.ts: count(chef_recipes) per chef, no deleted filter.
  { child: 'chef_recipes', fk: 'chef_id', parent: 'chefs', counter: 'recipe_count' },
  // collections.ts: +1/-1 per collection_recipes row, no deleted filter.
  {
    child: 'collection_recipes',
    fk: 'collection_id',
    parent: 'collections',
    counter: 'recipe_count',
  },
];

export interface GroupContext {
  db: Queryable;
  g: ResolvedGroup;
  batchId: string;
  refs: RecipeRef[];
  backupRefs: RecipeRef[];
  /** The signed dry run's per-member row counts (`memberRefs`). */
  signedRefs?: MemberDetail['memberRefs'];
  /** Collisions the signed dry run allows for this group (`expectedCollisions`). */
  allowed: Collision[];
  afterMoves?: (groupId: string) => Promise<void>;
}

export const bump = (counts: Record<string, number>, key: string, n: number) => {
  if (n > 0) counts[key] = (counts[key] ?? 0) + n;
};

const collisionId = (ref: string, key: string, loser: string) => `${ref}|${key}|${loser}`;

/** Step 1: lock, then assert existence, liveness, visibility and owner. */
async function lockAndAssert(ctx: GroupContext): Promise<void> {
  const { db, g } = ctx;
  const ids = [g.keeperId, ...g.losers];
  const { rows } = await db.query<{ id: string; pub: boolean; deleted: boolean; owner: string }>(
    `SELECT id, coalesce(is_public, false) AS pub, deleted_at IS NOT NULL AS deleted, user_id AS owner
     FROM recipes WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
    [ids]
  );
  if (rows.length !== ids.length) throw new Error(`${g.groupId}: a member recipe no longer exists`);
  const deleted = rows.filter((r) => r.deleted).map((r) => r.id);
  if (deleted.length > 0)
    throw new Error(`${g.groupId}: already soft-deleted: ${deleted.join(', ')}`);
  const keeper = rows.find((r) => r.id === g.keeperId);
  if (keeper?.pub !== g.isPublic) throw new Error(`${g.groupId}: keeper visibility changed`);
  if (!SYSTEM_OWNERS.includes(keeper.owner)) {
    throw new Error(`${g.groupId}: survivor ${g.keeperId} is owned by ${keeper.owner}, not system`);
  }
}

/**
 * Step 1 (#135, code-critic BLOCK): a loser holding two rows with one logical-key value
 * (`LOGICAL_KEYS`, e.g. recipe_tools (recipe_id, tool_id)) can be neither dropped nor
 * moved cleanly, so the group stops before any write.
 */
async function assertNoRepeatedLogicalKeys(ctx: GroupContext): Promise<void> {
  for (const ref of ctx.refs) {
    for (const key of ref.uniqueKeys.filter((k) => k.logical)) {
      const others = key.columns.filter((c) => c !== ref.column);
      const c = ident(ref.column);
      const { rows } = await ctx.db.query<{ loser: string; k: string; n: number }>(
        `SELECT x.${c}::text AS loser, ${otherKeySql(others, 'x')} AS k, count(*)::int AS n
         FROM ${ident(ref.table)} x WHERE x.${c}::text = ANY($1::text[])
         GROUP BY 1, 2 HAVING count(*) > 1 ORDER BY 1, 2`,
        [ctx.g.losers]
      );
      const hit = rows[0];
      if (hit) {
        throw new Error(
          `${ctx.g.groupId}: loser ${hit.loser} holds ${hit.n} ${ref.table} rows with the same (${key.columns.join(', ')}) key ${hit.k}; refusing the group`
        );
      }
    }
  }
}

/** Step 1 (A69 gap 4): no loser may carry more recipe_ingredients rows than the survivor. */
async function assertIngredients(ctx: GroupContext, counts: Record<string, number>): Promise<void> {
  const { db, g } = ctx;
  const { rows } = await db.query<{ id: string; n: number }>(
    `SELECT m.id, (SELECT count(*)::int FROM recipe_ingredients ri WHERE ri.recipe_id = m.id) AS n
     FROM unnest($1::text[]) AS m(id)`,
    [[g.keeperId, ...g.losers]]
  );
  const by = new Map(rows.map((r) => [r.id, r.n]));
  const survivor = by.get(g.keeperId) ?? 0;
  counts['ingredient rows on survivor'] = survivor;
  const ack = g.ackFewerIngredients;
  for (const loser of g.losers) {
    const n = by.get(loser) ?? 0;
    if (n <= survivor) continue;
    if (!ack || (ack.loser !== undefined && ack.loser !== loser)) {
      throw new Error(
        `${g.groupId}: loser ${loser} has ${n} recipe_ingredients rows, survivor ${g.keeperId} has ${survivor}; not listed in ack_fewer_ingredients`
      );
    }
  }
  if (!ack) return;
  // #135 (code-critic MEDIUM): an ack holds only for the counts it was signed against.
  for (const id of [g.keeperId, ...g.losers]) {
    const signedN = ctx.signedRefs?.[id]?.['recipe_ingredients.recipe_id'] ?? 0;
    const live = by.get(id) ?? 0;
    if (!ctx.signedRefs || live !== signedN) {
      throw new Error(
        `${g.groupId}: acknowledged group: ${id} has ${live} recipe_ingredients rows, the signed dry run recorded ${ctx.signedRefs ? signedN : 'nothing'}`
      );
    }
  }
  // An acknowledged group: its signed entry (reason_class, reason) and both counts go to the
  // ledger. The loser's rows stay on the soft-deleted loser.
  const loserRows = Object.fromEntries(g.losers.map((l) => [l, by.get(l) ?? 0]));
  await db.query(
    `INSERT INTO dedup_135_ledger (${LEDGER_COLS})
     VALUES ($1, $2, 'note', 'recipe_ingredients', 'recipe_id', NULL, NULL, $3,
       jsonb_build_object('ack', $4::jsonb, 'survivor_rows', $5::int, 'loser_rows', $6::jsonb))`,
    [ctx.batchId, g.groupId, g.keeperId, JSON.stringify(ack), survivor, JSON.stringify(loserRows)]
  );
  bump(counts, 'acknowledged ingredient-row groups', 1);
}

/** A69 gap 2: backup-table rows are never moved; each loser row id becomes a ledger note. */
async function noteBackups(ctx: GroupContext, counts: Record<string, number>): Promise<void> {
  for (const ref of ctx.backupRefs) {
    const c = ident(ref.column);
    const pk = ref.pkColumns.length > 0 ? pkJsonSql(ref.pkColumns, 'x') : 'NULL::jsonb';
    const data = ref.pkColumns.length > 0 ? 'NULL::jsonb' : 'to_jsonb(x)';
    const { rows } = await ctx.db.query<{ n: number }>(
      `WITH l AS (INSERT INTO dedup_135_ledger (${LEDGER_COLS})
         SELECT $2, $3, 'note', $4, $5, ${pk}, x.${c}::text, NULL, ${data}
         FROM ${ident(ref.table)} x WHERE x.${c}::text = ANY($1::text[]) RETURNING 1)
       SELECT count(*)::int AS n FROM l`,
      [ctx.g.losers, ctx.batchId, ctx.g.groupId, ref.table, ref.column]
    );
    bump(counts, `noted ${ref.table}.${ref.column} (not moved)`, rows[0]?.n ?? 0);
  }
}

/** Drops loser rows whose key the survivor holds; each must be in the signed allowed set. */
async function dropCollisions(
  ctx: GroupContext,
  ref: RecipeRef,
  loser: string,
  remaining: Set<string>
): Promise<number> {
  const { db, g } = ctx;
  const t = ident(ref.table);
  const c = ident(ref.column);
  let dropped = 0;
  for (const key of ref.uniqueKeys) {
    const others = key.columns.filter((col) => col !== ref.column);
    const match = others.map((o) => `y.${ident(o)} = x.${ident(o)}`).join(' AND ');
    const where = `x.${c}::text = $1 AND EXISTS (SELECT 1 FROM ${t} y WHERE y.${c}::text = $2${match ? ` AND ${match}` : ''})`;
    const found = await db.query<{ k: string }>(
      `SELECT ${otherKeySql(others, 'x')} AS k FROM ${t} x WHERE ${where}`,
      [loser, g.keeperId]
    );
    const kname = keyRefName(ref.table, ref.column, key.name);
    for (const { k } of found.rows) {
      const id = collisionId(kname, k, loser);
      if (!remaining.delete(id)) {
        throw new Error(
          `${g.groupId}: collision not in the signed dry run: ${kname} ${k} on ${loser}`
        );
      }
    }
    const { rows } = await db.query<{ n: number }>(
      `WITH d AS (DELETE FROM ${t} x WHERE ${where} RETURNING x.*),
       l AS (INSERT INTO dedup_135_ledger (${LEDGER_COLS})
         SELECT $3, $4, 'drop', $5, $6, ${pkJsonSql(ref.pkColumns, 'd')}, $1, $2, to_jsonb(d) FROM d
         RETURNING 1)
       SELECT count(*)::int AS n FROM l`,
      [loser, g.keeperId, ctx.batchId, g.groupId, ref.table, ref.column]
    );
    dropped += rows[0]?.n ?? 0;
  }
  return dropped;
}

async function moveRows(ctx: GroupContext, ref: RecipeRef, loser: string): Promise<number> {
  const t = ident(ref.table);
  const c = ident(ref.column);
  const { rows } = await ctx.db.query<{ n: number }>(
    `WITH m AS (UPDATE ${t} x SET ${c} = $2 WHERE x.${c}::text = $1
         RETURNING ${pkJsonSql(ref.pkColumns, 'x')} AS pk),
     l AS (INSERT INTO dedup_135_ledger (${LEDGER_COLS})
       SELECT $3, $4, 'move', $5, $6, m.pk, $1, $2, NULL FROM m RETURNING 1)
     SELECT count(*)::int AS n FROM l`,
    [loser, ctx.g.keeperId, ctx.batchId, ctx.g.groupId, ref.table, ref.column]
  );
  return rows[0]?.n ?? 0;
}

async function checkMovable(db: Queryable, ref: RecipeRef, losers: string[]): Promise<void> {
  const blocked = ref.pkColumns.length === 0 || ref.uniqueKeys.some((k) => k.partial);
  if (!blocked) return;
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${ident(ref.table)} WHERE ${ident(ref.column)}::text = ANY($1::text[])`,
    [losers]
  );
  if ((rows[0]?.n ?? 0) > 0) {
    throw new Error(
      `${ref.table}.${ref.column}: loser rows exist but the table has no primary key or a partial unique key`
    );
  }
}

/** Parents whose child rows sit on a loser now, i.e. whose membership the move changes. */
async function affectedParents(ctx: GroupContext): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (const p of PARENT_COUNTERS) {
    if (!ctx.refs.some((r) => r.table === p.child && r.column === 'recipe_id')) continue;
    const { rows } = await ctx.db.query<{ id: string }>(
      `SELECT DISTINCT ${ident(p.fk)}::text AS id FROM ${ident(p.child)} WHERE recipe_id = ANY($1::text[])`,
      [ctx.g.losers]
    );
    out.set(p.parent, rows.map((r) => r.id).sort());
  }
  return out;
}

/** Recounts each affected parent from live child rows; ledgers the prior value when it changes. */
async function recountParents(
  ctx: GroupContext,
  affected: Map<string, string[]>,
  counts: Record<string, number>
): Promise<void> {
  for (const p of PARENT_COUNTERS) {
    const ids = affected.get(p.parent) ?? [];
    if (ids.length === 0) continue;
    const [parent, counter, child, fk] = [p.parent, p.counter, p.child, p.fk].map(ident);
    const { rows } = await ctx.db.query<{ n: number }>(
      `WITH want AS (
         SELECT x.id, (SELECT count(*)::int FROM ${child} c WHERE c.${fk} = x.id) AS n
         FROM ${parent} x WHERE x.id::text = ANY($1::text[]) FOR UPDATE),
       l AS (INSERT INTO dedup_135_ledger (${LEDGER_COLS})
         SELECT $2, $3, 'parent', $4, $5, jsonb_build_object('id', x.id), NULL, NULL,
           jsonb_build_object($5::text, x.${counter}, 'after', w.n)
         FROM ${parent} x JOIN want w ON w.id = x.id
         WHERE x.${counter} IS DISTINCT FROM w.n RETURNING row_pk),
       u AS (UPDATE ${parent} x SET ${counter} = w.n FROM want w
         WHERE w.id = x.id AND x.${counter} IS DISTINCT FROM w.n RETURNING 1)
       SELECT (SELECT count(*)::int FROM u) AS n`,
      [ids, ctx.batchId, ctx.g.groupId, p.parent, p.counter]
    );
    bump(counts, `recounted ${p.parent}.${p.counter}`, rows[0]?.n ?? 0);
  }
}

/** Keeper counters the merge recomputes; ledgered before (prior) and after. */
export const KEEPER_COUNTERS = [
  'like_count',
  'fork_count',
  'collection_count',
  'total_user_ratings',
  'avg_user_rating',
];
const KEEPER_COUNTERS_JSON = KEEPER_COUNTERS.map((c) => `'${c}', ${c}`).join(', ');

/** Slug taken by a live or deleted recipe, or by a redirect's `from_slug`. */
const slugTakenIn = (db: Queryable) => async (slug: string, excludeId?: string) => {
  const { rows } = await db.query<{ n: number }>(
    `SELECT (SELECT count(*) FROM recipes WHERE slug = $1 AND id <> coalesce($2, ''))
       + (SELECT count(*) FROM recipe_redirects WHERE from_slug = $1) AS n`,
    [slug, excludeId ?? null]
  );
  return Number(rows[0]?.n ?? 0) > 0;
};

async function updateKeeper(ctx: GroupContext, counts: Record<string, number>): Promise<void> {
  const { db, g } = ctx;
  const { rows: led } = await db.query<{ id: number }>(
    `INSERT INTO dedup_135_ledger (${LEDGER_COLS})
     SELECT $2, $3, 'keeper', 'recipes', NULL, jsonb_build_object('id', id), id, id,
       jsonb_build_object('slug', slug, 'name', name, 'source', source, ${KEEPER_COUNTERS_JSON})
     FROM recipes WHERE id = $1 RETURNING id::int AS id`,
    [g.keeperId, ctx.batchId, g.groupId]
  );
  // like_count follows favorites (src/app/actions/favorites.ts); ratings as in rate-recipe.ts.
  const { rows } = await db.query<{ name: string; slug: string | null }>(
    `UPDATE recipes r SET
       name = btrim(r.name),
       source = coalesce($2, r.source),
       like_count = (SELECT count(*) FROM favorites WHERE recipe_id = r.id),
       fork_count = (SELECT count(*) FROM recipe_forks WHERE original_recipe_id = r.id),
       collection_count = (SELECT count(*) FROM collection_recipes WHERE recipe_id = r.id),
       total_user_ratings = (SELECT count(*) FROM recipe_ratings WHERE recipe_id = r.id),
       avg_user_rating = (SELECT CAST(AVG(rating) AS DECIMAL(2,1)) FROM recipe_ratings WHERE recipe_id = r.id)
     WHERE r.id = $1 RETURNING r.name, r.slug`,
    [g.keeperId, g.sourceOverride ?? null]
  );
  if (g.sourceOverride) bump(counts, 'survivor source overridden', 1);
  // #135 (code-critic): the counters after the recount, so rollback can reverse by difference.
  await db.query(
    `UPDATE dedup_135_ledger l SET row_data = l.row_data || jsonb_build_object('after',
       (SELECT jsonb_build_object(${KEEPER_COUNTERS_JSON}) FROM recipes WHERE id = $2))
     WHERE l.id = $1`,
    [led[0]?.id, g.keeperId]
  );
  const keeper = rows[0];
  if (!keeper || keeper.slug !== null) return;
  const slug = await generateUniqueSlug(keeper.name, g.keeperId, 100, slugTakenIn(db));
  await db.query('UPDATE recipes SET slug = $2 WHERE id = $1', [g.keeperId, slug]);
  bump(counts, 'keeper slug assigned', 1);
}

async function softDeleteAndRedirect(ctx: GroupContext, counts: Record<string, number>) {
  const { db, g, batchId } = ctx;
  await db.query(
    `INSERT INTO dedup_135_ledger (${LEDGER_COLS})
     SELECT $2, $3, 'soft_delete', 'recipes', NULL, jsonb_build_object('id', id), id, NULL,
       jsonb_build_object('deleted_at', deleted_at)
     FROM recipes WHERE id = ANY($1::text[])`,
    [g.losers, batchId, g.groupId]
  );
  await db.query('UPDATE recipes SET deleted_at = now() WHERE id = ANY($1::text[])', [g.losers]);
  bump(counts, 'soft-deleted', g.losers.length);
  await updateKeeper(ctx, counts);
  const { rows } = await db.query<{ n: number; slugs: number }>(
    `WITH i AS (INSERT INTO recipe_redirects (from_recipe_id, from_slug, to_recipe_id, batch_id)
         SELECT id, slug, $2, $3 FROM recipes WHERE id = ANY($1::text[]) RETURNING *),
     l AS (INSERT INTO dedup_135_ledger (${LEDGER_COLS})
       SELECT $3, $4, 'redirect', 'recipe_redirects', NULL,
         jsonb_build_object('from_recipe_id', i.from_recipe_id), i.from_recipe_id, i.to_recipe_id,
         to_jsonb(i) FROM i RETURNING 1)
     SELECT (SELECT count(*)::int FROM l) AS n, (SELECT count(from_slug)::int FROM i) AS slugs`,
    [g.losers, g.keeperId, batchId, g.groupId]
  );
  bump(counts, 'redirects by id', rows[0]?.n ?? 0);
  bump(counts, 'redirects by slug', rows[0]?.slugs ?? 0);
}

/**
 * Why: the unit of work of the merge; the caller wraps it in one transaction.
 * What: every assertion runs before the first write; then notes, drops (each
 * in the signed allowed set, and every allowed one must happen), moves,
 * parent recounts, soft-delete, keeper update, redirects and the marker row.
 * Test: `dedup-merge-apply.test.ts`
 */
export async function applyGroupInTx(ctx: GroupContext): Promise<Record<string, number>> {
  const { db, g } = ctx;
  const counts: Record<string, number> = {};
  await lockAndAssert(ctx);
  await assertNoRepeatedLogicalKeys(ctx);
  await assertIngredients(ctx, counts);
  for (const ref of ctx.refs) await checkMovable(db, ref, g.losers);
  const remaining = new Set(ctx.allowed.map((c) => collisionId(c.ref, c.key, c.loserId)));
  const affected = await affectedParents(ctx);
  await noteBackups(ctx, counts);
  for (const ref of ctx.refs) {
    for (const loser of g.losers) {
      const name = `${ref.table}.${ref.column}`;
      bump(counts, `dropped ${name}`, await dropCollisions(ctx, ref, loser, remaining));
      bump(counts, `moved ${name}`, await moveRows(ctx, ref, loser));
    }
  }
  if (remaining.size > 0) {
    throw new Error(
      `${g.groupId}: signed collision(s) did not occur: ${[...remaining].join('; ')}`
    );
  }
  await ctx.afterMoves?.(g.groupId);
  await recountParents(ctx, affected, counts);
  await softDeleteAndRedirect(ctx, counts);
  await db.query(
    `INSERT INTO dedup_135_ledger (${LEDGER_COLS})
     VALUES ($1, $2, 'group', NULL, NULL, NULL, NULL, $3, $4::jsonb)`,
    [ctx.batchId, g.groupId, g.keeperId, JSON.stringify({ losers: g.losers, counts })]
  );
  return counts;
}
