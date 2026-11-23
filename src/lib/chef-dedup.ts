/**
 * Why: chef discovery created duplicate chef rows (same person, several ids).
 * The owner decides which rows merge in a plan file; this module carries out
 * that plan safely. No merge rule lives here.
 * What: `parseDedupPlan` checks the plan's shape; `computeDedupPlan` reads the
 * involved chefs and links, validates the plan and simulates every step to get
 * the exact row counts each statement must touch; `executeDedupPlan` runs the
 * guarded statements and throws on any count mismatch; `applyDedupPlan` wraps
 * read + validate + execute in ONE transaction and rolls back on any error.
 * Test: `src/lib/__tests__/chef-dedup.test.ts`
 *
 * FKs to chefs.id (drizzle schema): chef_recipes.chef_id ON DELETE CASCADE,
 * recipes.chef_id ON DELETE SET NULL, scraping_jobs.chef_id ON DELETE SET NULL.
 */

/** Minimal query surface shared by `pg.Client` and a PGlite adapter. */
export interface Querier {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number }>;
}

export interface DedupPlan {
  merges: { survivor: string; losers: string[]; rename?: { name: string; slug: string } }[];
  reattribute: { chef: string; to: string }[];
  unlinkAndDelete: string[];
}

export class DedupError extends Error {}

/** One loser folded into a target (a merge loser or a reattributed chef). */
export interface MoveStep {
  kind: 'merge' | 'reattribute';
  loser: string;
  target: string;
  linksMoved: number;
  linksSkipped: number;
  recipesRepointed: number;
  jobsRepointed: number;
}

export interface UnlinkStep {
  chef: string;
  recipesUnlinked: number;
  linksDeleted: number;
  jobsUnlinked: number;
}

export interface ComputedPlan {
  names: Map<string, { name: string; slug: string }>;
  moves: MoveStep[];
  unlinks: UnlinkStep[];
  renames: { survivor: string; name: string; slug: string }[];
  /** Expected chefs.recipe_count per survivor/target after the run. */
  finalCounts: Map<string, number>;
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Checks the plan JSON's shape; throws DedupError naming the bad field. */
export function parseDedupPlan(raw: unknown): DedupPlan {
  const fail = (msg: string): never => {
    throw new DedupError(`invalid plan: ${msg}`);
  };
  if (!raw || typeof raw !== 'object') fail('not an object');
  const obj = raw as Record<string, unknown>;
  const merges = obj.merges ?? [];
  const reattribute = obj.reattribute ?? [];
  const unlinkAndDelete = obj.unlinkAndDelete ?? [];
  if (!Array.isArray(merges)) fail('merges must be an array');
  if (!Array.isArray(reattribute)) fail('reattribute must be an array');
  if (!Array.isArray(unlinkAndDelete)) fail('unlinkAndDelete must be an array');
  (merges as unknown[]).forEach((m, i) => {
    const g = m as Record<string, unknown>;
    if (!g || !isNonEmptyString(g.survivor)) fail(`merges[${i}].survivor missing`);
    if (!Array.isArray(g.losers) || g.losers.length === 0 || !g.losers.every(isNonEmptyString))
      fail(`merges[${i}].losers must be a non-empty array of ids`);
    if (g.rename !== undefined) {
      const r = g.rename as Record<string, unknown>;
      if (!r || !isNonEmptyString(r.name) || !isNonEmptyString(r.slug))
        fail(`merges[${i}].rename needs name and slug`);
    }
  });
  (reattribute as unknown[]).forEach((r, i) => {
    const g = r as Record<string, unknown>;
    if (!g || !isNonEmptyString(g.chef) || !isNonEmptyString(g.to))
      fail(`reattribute[${i}] needs chef and to`);
  });
  if (!(unlinkAndDelete as unknown[]).every(isNonEmptyString))
    fail('unlinkAndDelete must be an array of ids');
  return { merges, reattribute, unlinkAndDelete } as DedupPlan;
}

/**
 * Validation rules: every id exists and is active; an id removed by the plan
 * (loser, reattributed chef, unlinkAndDelete) appears once in the whole plan
 * and is never a survivor/target; a survivor heads one merge only; a rename
 * slug is unique among renames and not held by any row that survives.
 * A reattribute target may repeat and may be a merge survivor.
 */
function validate(plan: DedupPlan, chefRows: Map<string, ChefRow>, slugHolders: SlugRow[]) {
  const errors: string[] = [];
  const removed: string[] = [
    ...plan.merges.flatMap((m) => m.losers),
    ...plan.reattribute.map((r) => r.chef),
    ...plan.unlinkAndDelete,
  ];
  const survivors = plan.merges.map((m) => m.survivor);
  const targets = [...survivors, ...plan.reattribute.map((r) => r.to)];

  const seen = new Set<string>();
  for (const id of removed) {
    if (seen.has(id)) errors.push(`id ${id} is removed more than once in the plan`);
    seen.add(id);
  }
  const survivorSeen = new Set<string>();
  for (const id of survivors) {
    if (survivorSeen.has(id)) errors.push(`survivor ${id} heads more than one merge`);
    survivorSeen.add(id);
  }
  for (const id of new Set(targets)) {
    if (seen.has(id)) errors.push(`id ${id} is both a survivor/target and removed`);
  }
  for (const id of new Set([...removed, ...targets])) {
    const row = chefRows.get(id);
    if (!row) errors.push(`chef ${id} does not exist`);
    else if (row.is_active !== true) errors.push(`chef ${id} (${row.name}) is not active`);
  }
  const renameSlugs = new Set<string>();
  for (const m of plan.merges) {
    if (!m.rename) continue;
    const slug = m.rename.slug;
    if (renameSlugs.has(slug)) errors.push(`rename slug "${slug}" is used by two merges`);
    renameSlugs.add(slug);
    for (const holder of slugHolders) {
      if (holder.slug === slug && holder.id !== m.survivor && !seen.has(holder.id)) {
        errors.push(`rename slug "${slug}" is held by surviving chef ${holder.id} (${holder.name})`);
      }
    }
  }
  if (errors.length > 0) throw new DedupError(`plan rejected:\n- ${errors.join('\n- ')}`);
}

interface ChefRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean | null;
}
interface SlugRow {
  id: string;
  name: string;
  slug: string;
}

/**
 * Reads the involved rows (locking the chefs when `lock`), validates the plan,
 * and simulates each step in plan order: merges, then reattribute, then
 * unlinkAndDelete. Throws DedupError when validation fails.
 */
export async function computeDedupPlan(
  q: Querier,
  plan: DedupPlan,
  options: { lock?: boolean } = {}
): Promise<ComputedPlan> {
  const ids = [
    ...new Set([
      ...plan.merges.flatMap((m) => [m.survivor, ...m.losers]),
      ...plan.reattribute.flatMap((r) => [r.chef, r.to]),
      ...plan.unlinkAndDelete,
    ]),
  ];
  const lock = options.lock ? ' ORDER BY id FOR UPDATE' : '';
  const { rows: chefList } = await q.query<ChefRow>(
    `SELECT id::text AS id, name, slug, is_active FROM chefs WHERE id::text = ANY($1)${lock}`,
    [ids]
  );
  const chefRows = new Map(chefList.map((r) => [r.id, r]));
  const slugs = plan.merges.flatMap((m) => (m.rename ? [m.rename.slug] : []));
  const { rows: slugHolders } = await q.query<SlugRow>(
    'SELECT id::text AS id, name, slug FROM chefs WHERE slug = ANY($1)',
    [slugs]
  );
  validate(plan, chefRows, slugHolders);

  const links = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
  const { rows: linkRows } = await q.query<{ chef_id: string; recipe_id: string }>(
    'SELECT chef_id::text AS chef_id, recipe_id FROM chef_recipes WHERE chef_id::text = ANY($1)',
    [ids]
  );
  for (const r of linkRows) links.get(r.chef_id)?.add(r.recipe_id);
  const countBy = async (table: string) => {
    const { rows } = await q.query<{ chef_id: string; n: number }>(
      `SELECT chef_id::text AS chef_id, count(*)::int AS n FROM ${table}
       WHERE chef_id::text = ANY($1) GROUP BY chef_id`,
      [ids]
    );
    const m = new Map<string, number>(ids.map((id) => [id, 0]));
    for (const r of rows) m.set(r.chef_id, Number(r.n));
    return m;
  };
  const recipeRefs = await countBy('recipes');
  const jobRefs = await countBy('scraping_jobs');

  const moves: MoveStep[] = [];
  const fold = (kind: MoveStep['kind'], loser: string, target: string) => {
    const from = links.get(loser) as Set<string>;
    const into = links.get(target) as Set<string>;
    let moved = 0;
    let skipped = 0;
    for (const recipe of from) {
      if (into.has(recipe)) skipped++;
      else {
        into.add(recipe);
        moved++;
      }
    }
    from.clear();
    moves.push({
      kind,
      loser,
      target,
      linksMoved: moved,
      linksSkipped: skipped,
      recipesRepointed: recipeRefs.get(loser) ?? 0,
      jobsRepointed: jobRefs.get(loser) ?? 0,
    });
    recipeRefs.set(target, (recipeRefs.get(target) ?? 0) + (recipeRefs.get(loser) ?? 0));
    jobRefs.set(target, (jobRefs.get(target) ?? 0) + (jobRefs.get(loser) ?? 0));
    recipeRefs.set(loser, 0);
    jobRefs.set(loser, 0);
  };
  for (const m of plan.merges) for (const loser of m.losers) fold('merge', loser, m.survivor);
  for (const r of plan.reattribute) fold('reattribute', r.chef, r.to);

  const unlinks: UnlinkStep[] = plan.unlinkAndDelete.map((chef) => ({
    chef,
    recipesUnlinked: recipeRefs.get(chef) ?? 0,
    linksDeleted: links.get(chef)?.size ?? 0,
    jobsUnlinked: jobRefs.get(chef) ?? 0,
  }));

  const finalCounts = new Map<string, number>();
  for (const id of [...plan.merges.map((m) => m.survivor), ...plan.reattribute.map((r) => r.to)]) {
    finalCounts.set(id, links.get(id)?.size ?? 0);
  }
  const names = new Map(chefList.map((r) => [r.id, { name: r.name, slug: r.slug }]));
  const renames = plan.merges.flatMap((m) =>
    m.rename ? [{ survivor: m.survivor, name: m.rename.name, slug: m.rename.slug }] : []
  );
  return { names, moves, unlinks, renames, finalCounts };
}

/** Runs one statement and throws unless it touched exactly `expected` rows. */
async function guarded(q: Querier, label: string, expected: number, sql: string, params: unknown[]) {
  const { rowCount } = await q.query(sql, params);
  if (rowCount !== expected) {
    throw new DedupError(`${label}: expected ${expected} rows, got ${rowCount}; rolled back`);
  }
}

/**
 * Executes a computed plan. Must run inside a transaction: it throws on the
 * first row-count mismatch and leaves the rollback to the caller.
 */
export async function executeDedupPlan(q: Querier, c: ComputedPlan): Promise<void> {
  for (const s of c.moves) {
    const tag = `${s.kind} ${s.loser} -> ${s.target}`;
    await guarded(
      q,
      `${tag} move links`,
      s.linksMoved,
      `UPDATE chef_recipes SET chef_id = $2 WHERE chef_id = $1
       AND recipe_id NOT IN (SELECT recipe_id FROM chef_recipes WHERE chef_id = $2)`,
      [s.loser, s.target]
    );
    await guarded(q, `${tag} drop duplicate links`, s.linksSkipped,
      'DELETE FROM chef_recipes WHERE chef_id = $1', [s.loser]);
    await guarded(q, `${tag} repoint recipes`, s.recipesRepointed,
      'UPDATE recipes SET chef_id = $2 WHERE chef_id = $1', [s.loser, s.target]);
    await guarded(q, `${tag} repoint scraping_jobs`, s.jobsRepointed,
      'UPDATE scraping_jobs SET chef_id = $2 WHERE chef_id = $1', [s.loser, s.target]);
    await guarded(q, `${tag} delete chef`, 1, 'DELETE FROM chefs WHERE id = $1', [s.loser]);
  }
  for (const u of c.unlinks) {
    const tag = `unlinkAndDelete ${u.chef}`;
    await guarded(q, `${tag} unlink recipes`, u.recipesUnlinked,
      'UPDATE recipes SET chef_id = NULL WHERE chef_id = $1', [u.chef]);
    await guarded(q, `${tag} delete links`, u.linksDeleted,
      'DELETE FROM chef_recipes WHERE chef_id = $1', [u.chef]);
    await guarded(q, `${tag} unlink scraping_jobs`, u.jobsUnlinked,
      'UPDATE scraping_jobs SET chef_id = NULL WHERE chef_id = $1', [u.chef]);
    await guarded(q, `${tag} delete chef`, 1, 'DELETE FROM chefs WHERE id = $1', [u.chef]);
  }
  // Renames run after the deletes so a loser's slug is free to take.
  for (const r of c.renames) {
    await guarded(q, `rename ${r.survivor}`, 1,
      'UPDATE chefs SET name = $2, slug = $3, updated_at = now() WHERE id = $1',
      [r.survivor, r.name, r.slug]);
  }
  for (const [id, expected] of c.finalCounts) {
    const { rows } = await q.query<{ recipe_count: number }>(
      `UPDATE chefs SET recipe_count =
         (SELECT count(*)::int FROM chef_recipes cr WHERE cr.chef_id = chefs.id), updated_at = now()
       WHERE id = $1 RETURNING recipe_count`,
      [id]
    );
    if (rows.length !== 1 || Number(rows[0].recipe_count) !== expected) {
      throw new DedupError(
        `recount ${id}: expected recipe_count ${expected}, got ${rows[0]?.recipe_count ?? 'no row'}; rolled back`
      );
    }
  }
}

/** Reads, validates and executes the plan in ONE transaction; rolls back on any error. */
export async function applyDedupPlan(q: Querier, plan: DedupPlan): Promise<ComputedPlan> {
  await q.query('BEGIN');
  try {
    const computed = await computeDedupPlan(q, plan, { lock: true });
    await executeDedupPlan(q, computed);
    await q.query('COMMIT');
    return computed;
  } catch (error) {
    await q.query('ROLLBACK');
    throw error;
  }
}

/** Dry-run report: per group, names, link counts moved, conflicts skipped, final recipe_count. */
export function renderDedupPlan(c: ComputedPlan): string[] {
  const label = (id: string) => `${c.names.get(id)?.name ?? '?'} [${id}]`;
  const out: string[] = [];
  const targets = [...new Set(c.moves.map((s) => s.target))];
  for (const t of targets) {
    out.push('---');
    const rename = c.renames.find((r) => r.survivor === t);
    out.push(`target:  ${label(t)}${rename ? ` -> rename "${rename.name}" (${rename.slug})` : ''}`);
    for (const s of c.moves.filter((m) => m.target === t)) {
      out.push(
        `  ${s.kind} ${label(s.loser)}: move ${s.linksMoved} links, skip ${s.linksSkipped} conflicts, ` +
          `repoint ${s.recipesRepointed} recipes, ${s.jobsRepointed} scraping_jobs`
      );
    }
    out.push(`  resulting recipe_count: ${c.finalCounts.get(t)}`);
  }
  for (const u of c.unlinks) {
    out.push('---');
    out.push(
      `unlinkAndDelete ${label(u.chef)}: null ${u.recipesUnlinked} recipes, delete ${u.linksDeleted} links, ` +
        `null ${u.jobsUnlinked} scraping_jobs`
    );
  }
  return out;
}
