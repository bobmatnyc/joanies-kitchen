/**
 * #135: apply the signed duplicate merge, one transaction per group.
 *
 * Why: owner ruling Dcc — staged soft-delete merge. Every dependent row moves
 * to the survivor, losers are soft-deleted and redirected, and each change is
 * written to `dedup_135_ledger` in the same transaction so
 * `dedup-merge-rollback.ts` can undo it exactly.
 * What: `runApply` validates the decisions file, pins the live data to the
 * signed dry run (`checkPinned`, A69), applies the phase's groups
 * (`applyGroupInTx`) and runs the post-checks after every batch. A group with a
 * live ledger marker is skipped, so a re-run resumes.
 * Test: `src/lib/recipes/__tests__/dedup-merge-apply.test.ts`
 */

import {
  discoverBackupRefs,
  discoverRecipeRefs,
  ident,
  inTransaction,
  type Queryable,
  type RecipeRef,
} from './dedup-merge-db';
import {
  type DecisionsFile,
  parseDecisions,
  type ResolvedGroup,
  resolveGroups,
  validateDecisions,
} from './dedup-merge-decisions';
import { applyGroupInTx, bump } from './dedup-merge-group';
import {
  checkPinned,
  expectedCollisions,
  PinError,
  type PinPlan,
  type PinReport,
} from './dedup-merge-pin';

export interface ApplyOptions {
  batchId: string;
  phase: 1 | 2;
  limit?: number;
  /** Groups applied between post-checks (A69 gap 3). Default 50. */
  batchSize?: number;
  /** Run every group's full transaction, then roll it back. */
  dry?: boolean;
  /** Keep going after a failed group (it rolls back alone). */
  continueOnError?: boolean;
  /** Test hook: runs inside the group transaction after the row moves. */
  afterMoves?: (groupId: string) => Promise<void>;
}

export type GroupStatus = 'applied' | 'skipped-applied' | 'skipped-no-merge' | 'failed';

export interface GroupResult {
  groupId: string;
  status: GroupStatus;
  counts: Record<string, number>;
  error?: string;
}

export const DEFAULT_BATCH_SIZE = 50;

/** Group ids with a live (not rolled back) completion marker. */
export async function appliedGroupIds(db: Queryable): Promise<Set<string>> {
  const { rows } = await db.query<{ group_id: string }>(
    `SELECT DISTINCT group_id FROM dedup_135_ledger WHERE kind = 'group' AND rolled_back_at IS NULL`
  );
  return new Set(rows.map((r) => r.group_id));
}

async function deletedCount(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM recipes WHERE deleted_at IS NOT NULL'
  );
  return rows[0]?.n ?? 0;
}

/**
 * A69 gap 3: after every batch, the soft-deleted total must equal the start
 * total plus this run's losers, every ledgered loser must be soft-deleted, and
 * no moved table may still hold a row pointing at a ledgered loser.
 * Returns the problems found; empty means pass.
 */
export async function postCheck(
  db: Queryable,
  refs: RecipeRef[],
  expectedDeleted: number
): Promise<string[]> {
  const problems: string[] = [];
  const now = await deletedCount(db);
  if (now !== expectedDeleted) {
    problems.push(`soft-deleted recipes: ${now}, expected ${expectedDeleted}`);
  }
  const { rows } = await db.query<{ id: string; live: boolean }>(
    `SELECT l.old_recipe_id AS id, r.deleted_at IS NULL AS live
     FROM dedup_135_ledger l JOIN recipes r ON r.id = l.old_recipe_id
     WHERE l.kind = 'soft_delete' AND l.rolled_back_at IS NULL`
  );
  const live = rows.filter((r) => r.live).map((r) => r.id);
  if (live.length) problems.push(`ledgered losers not soft-deleted: ${live.join(', ')}`);
  const losers = rows.map((r) => r.id);
  for (const ref of refs) {
    const { rows: c } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${ident(ref.table)} WHERE ${ident(ref.column)}::text = ANY($1::text[])`,
      [losers]
    );
    const n = c[0]?.n ?? 0;
    if (n > 0)
      problems.push(`${ref.table}.${ref.column}: ${n} row(s) still point at an applied loser`);
  }
  return problems;
}

export interface RunApplyInput {
  /** The signed dry-run plan (parsed JSON) and the sha256 of its file bytes. */
  signedPlan: PinPlan;
  signedPlanSha256: string;
  /** Raw decisions-file text; empty or undefined refuses the run. */
  decisionsText: string | undefined;
  /** The plan recomputed from the live database (`buildPlan`). */
  recomputedPlan: PinPlan;
}

export interface RunApplyResult {
  decisions: DecisionsFile;
  pin: PinReport;
  results: GroupResult[];
  totals: Record<string, number>;
  /** Set when a post-check failed; the run stopped there. */
  stopped?: string;
}

interface RunState {
  refs: RecipeRef[];
  backupRefs: RecipeRef[];
  applied: Set<string>;
}

async function runGroup(
  db: Queryable,
  g: ResolvedGroup,
  signed: PinPlan,
  st: RunState,
  opts: ApplyOptions
): Promise<GroupResult> {
  if (g.losers.length === 0) return { groupId: g.groupId, status: 'skipped-no-merge', counts: {} };
  if (st.applied.has(g.groupId)) {
    const { rows } = await db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM recipes WHERE id = ANY($1::text[]) AND deleted_at IS NOT NULL',
      [g.losers]
    );
    if (rows[0]?.n !== g.losers.length) {
      throw new Error(`${g.groupId}: ledger says applied but not every loser is soft-deleted`);
    }
    return { groupId: g.groupId, status: 'skipped-applied', counts: {} };
  }
  const allowed = expectedCollisions(g.keeperId, g.losers, signed.memberKeys ?? {});
  try {
    const counts = await inTransaction(
      db,
      () =>
        applyGroupInTx({
          db,
          g,
          batchId: opts.batchId,
          refs: st.refs,
          backupRefs: st.backupRefs,
          allowed,
          signedRefs: signed.memberRefs,
          afterMoves: opts.afterMoves,
        }),
      { rollback: opts.dry }
    );
    return { groupId: g.groupId, status: 'applied', counts };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { groupId: g.groupId, status: 'failed', counts: {}, error };
  }
}

/**
 * Why: the single entry point the CLI and tests share, so the refusals
 * (unsigned file, any difference from the signed dry run) cannot be bypassed.
 * What: validate -> resolve -> pin check -> apply the phase's groups in order,
 * up to `limit` groups that need work, with a post-check every `batchSize`
 * applied groups and at the end. Throws `DecisionsError` or `PinError` before
 * any write.
 * Test: `dedup-merge-apply.test.ts`
 */
export async function runApply(
  db: Queryable,
  input: RunApplyInput,
  opts: ApplyOptions
): Promise<RunApplyResult> {
  const raw = parseDecisions(input.decisionsText);
  const decisions = validateDecisions(raw, input.signedPlan.groups, input.signedPlanSha256);
  const resolved = resolveGroups(input.signedPlan.groups, decisions);
  const applied = await appliedGroupIds(db);
  const pin = checkPinned(input.signedPlan, input.recomputedPlan, resolved, applied);
  if (!pin.ok) throw new PinError(pin);
  const st: RunState = {
    refs: await discoverRecipeRefs(db),
    backupRefs: await discoverBackupRefs(db),
    applied,
  };
  const out: RunApplyResult = { decisions, pin, results: [], totals: {} };
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  let expectedDeleted = await deletedCount(db);
  let worked = 0;
  let sinceCheck = 0;
  const check = async () => {
    sinceCheck = 0;
    const problems = await postCheck(db, st.refs, expectedDeleted);
    if (problems.length) out.stopped = `post-check failed: ${problems.join('; ')}`;
    bump(out.totals, 'post-checks run', 1);
  };
  for (const g of resolved.filter((x) => x.phase === opts.phase)) {
    if (opts.limit !== undefined && worked >= opts.limit) break;
    const r = await runGroup(db, g, input.signedPlan, st, opts);
    out.results.push(r);
    for (const [k, n] of Object.entries(r.counts)) bump(out.totals, k, n);
    bump(out.totals, `groups ${r.status}`, 1);
    if (r.status === 'applied' || r.status === 'failed') worked++;
    if (r.status === 'applied') {
      if (!opts.dry) expectedDeleted += g.losers.length;
      if (++sinceCheck >= batchSize) await check();
    }
    if (out.stopped || (r.status === 'failed' && !opts.continueOnError)) break;
  }
  if (!out.stopped && sinceCheck > 0) await check();
  return out;
}
