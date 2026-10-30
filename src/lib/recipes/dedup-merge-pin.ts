/**
 * #135 (A69): pins the apply to the exact signed dry run.
 *
 * Why: A69 found the count windows could let new, unreviewed groups or a
 * swapped member through. The apply must stop on any difference, without a
 * person reading a table.
 * What: `checkPinned` compares the signed dry-run JSON with the plan
 * recomputed from the live database. Not yet applied groups must match by
 * group id and member ids exactly; per-table loser-row counts over the
 * post-decision losers must match exactly, except `recipe_views` (5% band).
 * `expectedCollisions` derives the unique-key collisions a group may drop
 * from the signed per-member keys, in apply order.
 * Test: `src/lib/recipes/__tests__/dedup-merge-pin.test.ts`
 */

import { isBackupTable, STAY_WITH_LOSER } from './dedup-merge-db';
import type { ResolvedGroup, SignedGroup } from './dedup-merge-decisions';

/** Per-member detail recorded by `scripts/dedup-135/plan.ts` (read-only). */
export interface MemberDetail {
  /** member id -> `table.column` -> rows referencing the member (non-zero only). */
  memberRefs: Record<string, Record<string, number>>;
  /** member id -> `table.column#index` -> other key values (`otherKeySql` text), one per row. */
  memberKeys: Record<string, Record<string, string[]>>;
}

/** The parts of a dry-run plan the pin check reads. Old dry runs lack the detail. */
export interface PinPlan extends Partial<MemberDetail> {
  groups: SignedGroup[];
}

export interface Collision {
  ref: string;
  key: string;
  loserId: string;
  survivorId: string;
}

export const VIEWS_REF = 'recipe_views.recipe_id';
export const VIEWS_PCT = 5;

/**
 * Mirrors the apply: per key ref, the survivor's keys are taken first, then
 * each loser in order; a loser key already taken collides (and is dropped). A
 * key holding NULL never collides.
 */
export function expectedCollisions(
  survivorId: string,
  losers: readonly string[],
  memberKeys: MemberDetail['memberKeys']
): Collision[] {
  const refs = new Set([survivorId, ...losers].flatMap((id) => Object.keys(memberKeys[id] ?? {})));
  const out: Collision[] = [];
  for (const ref of [...refs].sort()) {
    const hasNull = (k: string) => (JSON.parse(k) as unknown[]).some((v) => v === null);
    const taken = new Set((memberKeys[survivorId]?.[ref] ?? []).filter((k) => !hasNull(k)));
    for (const loserId of losers) {
      const keys = (memberKeys[loserId]?.[ref] ?? []).filter((k) => !hasNull(k));
      // #135 (code-critic BLOCK): a key repeated on one loser (possible only on a logical
      // key) is neither a collision nor a move; the apply refuses that group in step 1.
      const repeated = new Set(keys.filter((k, i) => keys.indexOf(k) !== i));
      for (const key of keys) {
        if (repeated.has(key)) continue;
        if (taken.has(key)) out.push({ ref, key, loserId, survivorId });
        else taken.add(key);
      }
    }
  }
  return out;
}

/** Keys a loser holds more than once (logical keys only); the apply refuses such a group. */
export function repeatedKeys(
  losers: readonly string[],
  memberKeys: MemberDetail['memberKeys']
): Array<{ ref: string; key: string; loserId: string; count: number }> {
  const out: Array<{ ref: string; key: string; loserId: string; count: number }> = [];
  for (const loserId of losers) {
    for (const [ref, keys] of Object.entries(memberKeys[loserId] ?? {})) {
      const seen = new Map<string, number>();
      for (const k of keys) seen.set(k, (seen.get(k) ?? 0) + 1);
      for (const [key, count] of seen) if (count > 1) out.push({ ref, key, loserId, count });
    }
  }
  return out;
}

export interface PinReport {
  ok: boolean;
  problems: string[];
  /** Signed groups not applied yet (all of them match, or the report is not ok). */
  pending: Set<string>;
  applied: string[];
  rows: Array<{ ref: string; signed: number; now: number; ok: boolean }>;
}

export class PinError extends Error {
  constructor(public readonly report: PinReport) {
    super(`live data differs from the signed dry run:\n- ${report.problems.join('\n- ')}`);
    this.name = 'PinError';
  }
}

const sortedIds = (g: SignedGroup) => g.members.map((m) => m.id).sort();
const movable = (ref: string) => {
  const table = ref.split('.')[0] ?? '';
  return !STAY_WITH_LOSER.has(table) && !isBackupTable(table);
};

function sumRefs(refs: MemberDetail['memberRefs'], losers: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of losers) {
    for (const [ref, n] of Object.entries(refs[id] ?? {})) {
      if (movable(ref)) out.set(ref, (out.get(ref) ?? 0) + n);
    }
  }
  return out;
}

/**
 * Why: the single pre-write gate of the apply (A69 tolerance findings 2-4).
 * What: every difference becomes one line in `problems`; `ok` only when there
 * are none. Groups already applied (ledger marker) are left out of both sides.
 * Test: `dedup-merge-pin.test.ts`
 */
export function checkPinned(
  signed: PinPlan,
  live: PinPlan,
  resolved: readonly ResolvedGroup[],
  applied: ReadonlySet<string>
): PinReport {
  const r: PinReport = { ok: false, problems: [], pending: new Set(), applied: [], rows: [] };
  if (!signed.memberRefs || !signed.memberKeys) {
    r.problems.push(
      'signed dry run has no per-member detail (memberRefs/memberKeys); re-run plan.ts'
    );
    return r;
  }
  if (!live.memberRefs) throw new Error('recomputed plan has no memberRefs');
  const liveById = new Map(live.groups.map((g) => [g.groupId, g]));
  const signedIds = new Set(signed.groups.map((g) => g.groupId));
  for (const g of live.groups) {
    if (!signedIds.has(g.groupId) && !applied.has(g.groupId)) {
      r.problems.push(`new group ${g.groupId} (${g.key}) is not in the signed dry run`);
    }
  }
  for (const g of signed.groups) {
    if (applied.has(g.groupId)) {
      r.applied.push(g.groupId);
      continue;
    }
    const cur = liveById.get(g.groupId);
    if (!cur) {
      r.problems.push(`signed group ${g.groupId} (${g.key}) is missing now`);
      continue;
    }
    const [want, have] = [sortedIds(g), sortedIds(cur)];
    const added = have.filter((id) => !want.includes(id));
    const gone = want.filter((id) => !have.includes(id));
    if (added.length) r.problems.push(`${g.groupId}: member(s) added: ${added.join(', ')}`);
    if (gone.length) r.problems.push(`${g.groupId}: member(s) missing: ${gone.join(', ')}`);
    r.pending.add(g.groupId);
  }
  const losers = resolved.filter((g) => r.pending.has(g.groupId)).flatMap((g) => g.losers);
  const before = sumRefs(signed.memberRefs, losers);
  const after = sumRefs(live.memberRefs, losers);
  for (const ref of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const s = before.get(ref) ?? 0;
    const n = after.get(ref) ?? 0;
    const ok = ref === VIEWS_REF ? Math.abs(n - s) * 100 <= s * VIEWS_PCT : n === s;
    r.rows.push({ ref, signed: s, now: n, ok });
    if (!ok) {
      const allowed = ref === VIEWS_REF ? `within ${VIEWS_PCT}%` : 'exactly';
      r.problems.push(
        `${ref}: ${n} rows on post-decision losers now, signed ${s} (must match ${allowed})`
      );
    }
  }
  r.ok = r.problems.length === 0;
  return r;
}
