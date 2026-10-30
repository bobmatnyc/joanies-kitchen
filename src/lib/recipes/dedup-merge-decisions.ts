/**
 * #135: Bob's sign-off for the duplicate merge, as a validated decisions file.
 *
 * Why: the rules alone would retire members of the 11 no-merge groups and the
 * different recipe in each partial group. Apply must act only on a signed list
 * that names the exact dry run it was reviewed against.
 * What: parses the JSON, rejects unsigned files, hash mismatches, unknown
 * groups, keepers or retired ids outside their group, and any review group
 * without a decision; then resolves every dry-run group to keeper + losers.
 * Auto (non-review) groups keep the dry run's rule keeper unless overridden.
 * Test: `src/lib/recipes/__tests__/dedup-merge-decisions.test.ts`
 */
import { createHash } from 'node:crypto';

/** The parts of a dry-run group (`scripts/dedup-135/plan.ts` output) that apply reads. */
export interface SignedGroup {
  groupId: string;
  key: string;
  isPublic: boolean;
  needsReview: boolean;
  keeperId: string;
  members: Array<{ id: string; slug: string | null }>;
}

/** `source_override` (A69, G13) replaces the survivor's `source`; ledgered and reversible. */
export type GroupDecision =
  | { action: 'merge'; keeper: string; source_override?: string }
  | { action: 'no_merge' }
  | { action: 'partial'; keeper: string; retire: string[]; source_override?: string };

export interface DecisionsFile {
  signed_by: string;
  signed_at: string;
  /** sha256 (hex) of the dry-run JSON file's bytes. */
  dry_run_sha256: string;
  decisions: Record<string, GroupDecision>;
  /** A69: groups allowed to proceed although a loser has more recipe_ingredients rows. */
  ack_fewer_ingredients?: AckList | AckMap;
}

/** One acknowledgement; `survivor`/`loser`, when given, must match the resolved group. */
export interface Ack {
  reason: string;
  /** Signed file: `strict-duplicate` or `variant-match`; written to the ledger as given. */
  reason_class?: string;
  survivor?: string;
  loser?: string;
}
/** Draft shape: group id -> ack. */
export type AckMap = Record<string, Ack>;
/** List shape: one entry per group. */
export type AckList = Array<Ack & { group_id: string }>;

/** Both accepted shapes, normalised to group id -> ack. */
export function ackEntries(acks: unknown): Array<[string, unknown]> {
  if (Array.isArray(acks)) {
    return acks.map((a) => [isRecord(a) && typeof a.group_id === 'string' ? a.group_id : '?', a]);
  }
  return isRecord(acks) ? Object.entries(acks) : [];
}

/** One group's resolved merge: `losers` empty means the group is left alone. */
export interface ResolvedGroup {
  groupId: string;
  phase: 1 | 2;
  isPublic: boolean;
  keeperId: string;
  losers: string[];
  /** All dry-run member ids, for the drift check. */
  memberIds: string[];
  source: 'rules' | 'decision';
  sourceOverride?: string;
  /** The group's `ack_fewer_ingredients` entry, when listed. */
  ackFewerIngredients?: Ack;
}

export class DecisionsError extends Error {
  constructor(public readonly problems: string[]) {
    super(`decisions file rejected:\n- ${problems.join('\n- ')}`);
    this.name = 'DecisionsError';
  }
}

export const sha256Hex = (bytes: string | Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Throws `DecisionsError` on an empty or non-JSON text. */
export function parseDecisions(text: string | undefined): unknown {
  if (!text?.trim()) throw new DecisionsError(['decisions file is missing or empty']);
  try {
    return JSON.parse(text);
  } catch {
    throw new DecisionsError(['decisions file is not valid JSON']);
  }
}

function checkDecision(id: string, d: unknown, g: SignedGroup, problems: string[]): void {
  const members = new Set(g.members.map((m) => m.id));
  if (!isRecord(d)) {
    problems.push(`${id}: decision is not an object`);
    return;
  }
  if (d.action === 'no_merge') {
    if ('source_override' in d) problems.push(`${id}: source_override needs a survivor`);
    return;
  }
  if (d.action !== 'merge' && d.action !== 'partial') {
    problems.push(`${id}: action must be merge, no_merge or partial`);
    return;
  }
  if (typeof d.keeper !== 'string' || !members.has(d.keeper)) {
    problems.push(`${id}: keeper ${String(d.keeper)} is not a member of the group`);
  }
  if ('source_override' in d) {
    const so = d.source_override;
    if (typeof so !== 'string' || !/^https?:\/\/\S+$/.test(so)) {
      problems.push(`${id}: source_override must be an http(s) URL`);
    }
  }
  if (d.action === 'merge' && 'retire' in d) {
    // The draft lists losers on merge entries too; they must be exactly the non-keepers.
    const want = [...members].filter((m) => m !== d.keeper).sort();
    const got = Array.isArray(d.retire) ? [...d.retire].map(String).sort() : [];
    if (want.join() !== got.join()) {
      problems.push(`${id}: merge retire list must be every member except the keeper`);
    }
  }
  if (d.action === 'partial') {
    const retire = d.retire;
    if (!Array.isArray(retire) || retire.length === 0) {
      problems.push(`${id}: partial needs a non-empty retire list`);
      return;
    }
    for (const r of retire) {
      if (typeof r !== 'string' || !members.has(r)) {
        problems.push(`${id}: retire id ${String(r)} is not a member of the group`);
      } else if (r === d.keeper) problems.push(`${id}: retire list contains the keeper`);
    }
    if (new Set(retire).size !== retire.length) problems.push(`${id}: retire list repeats an id`);
  }
}

/**
 * Why: apply refuses to run unless this returns.
 * What: validates `raw` against the dry-run groups and the dry-run file hash;
 * collects every problem before throwing one `DecisionsError`.
 * Test: `dedup-merge-decisions.test.ts`
 */
export function validateDecisions(
  raw: unknown,
  groups: readonly SignedGroup[],
  dryRunSha256: string
): DecisionsFile {
  const problems: string[] = [];
  if (!isRecord(raw)) throw new DecisionsError(['decisions file is not a JSON object']);
  if (typeof raw.signed_by !== 'string' || !raw.signed_by.trim()) {
    problems.push('unsigned: signed_by is empty');
  }
  if (typeof raw.signed_at !== 'string' || Number.isNaN(Date.parse(raw.signed_at))) {
    problems.push('unsigned: signed_at is not a date');
  }
  if (raw.dry_run_sha256 !== dryRunSha256) {
    problems.push(
      `dry-run hash mismatch: signed against ${String(raw.dry_run_sha256)}, file is ${dryRunSha256}`
    );
  }
  const decisions = isRecord(raw.decisions) ? raw.decisions : undefined;
  if (!decisions) problems.push('decisions is not an object');
  const byId = new Map(groups.map((g) => [g.groupId, g]));
  for (const [id, d] of Object.entries(decisions ?? {})) {
    const g = byId.get(id);
    if (!g) problems.push(`${id}: unknown group id (not in the dry run)`);
    else checkDecision(id, d, g, problems);
  }
  const acks = raw.ack_fewer_ingredients;
  if (acks !== undefined && !Array.isArray(acks) && !isRecord(acks)) {
    problems.push('ack_fewer_ingredients must be a list or an object keyed by group id');
  }
  for (const [gid, a] of ackEntries(acks)) {
    const g = byId.get(gid);
    if (!g) {
      problems.push(`ack_fewer_ingredients: unknown group ${gid}`);
      continue;
    }
    if (!isRecord(a) || typeof a.reason !== 'string' || !a.reason.trim()) {
      problems.push(`ack_fewer_ingredients: ${gid} has no reason`);
      continue;
    }
    const d = decisions?.[gid];
    const keeper = isRecord(d) && typeof d.keeper === 'string' ? d.keeper : g.keeperId;
    if (a.survivor !== undefined && a.survivor !== keeper) {
      problems.push(
        `ack_fewer_ingredients: ${gid} survivor ${String(a.survivor)} is not the group's survivor ${keeper}`
      );
    }
    if (a.loser !== undefined && (a.loser === keeper || !g.members.some((m) => m.id === a.loser))) {
      problems.push(
        `ack_fewer_ingredients: ${gid} loser ${String(a.loser)} is not a loser of the group`
      );
    }
  }
  for (const g of groups) {
    if (g.needsReview && !(decisions && g.groupId in decisions)) {
      problems.push(`${g.groupId} (${g.key}): review group has no decision`);
    }
  }
  if (problems.length > 0) throw new DecisionsError(problems);
  return raw as unknown as DecisionsFile;
}

/** Every dry-run group with its keeper and losers under the signed decisions. */
export function resolveGroups(
  groups: readonly SignedGroup[],
  file: DecisionsFile
): ResolvedGroup[] {
  const acks = new Map(ackEntries(file.ack_fewer_ingredients) as Array<[string, Ack]>);
  return groups.map((g) => {
    const memberIds = g.members.map((m) => m.id);
    const d = file.decisions[g.groupId];
    const base = {
      groupId: g.groupId,
      phase: g.needsReview ? 2 : 1,
      isPublic: g.isPublic,
      memberIds,
      ackFewerIngredients: acks.get(g.groupId),
    };
    if (!d) {
      const losers = memberIds.filter((id) => id !== g.keeperId);
      return { ...base, keeperId: g.keeperId, losers, source: 'rules' } as ResolvedGroup;
    }
    if (d.action === 'no_merge') {
      return { ...base, keeperId: g.keeperId, losers: [], source: 'decision' } as ResolvedGroup;
    }
    const losers =
      d.action === 'partial' ? [...d.retire] : memberIds.filter((id) => id !== d.keeper);
    return {
      ...base,
      keeperId: d.keeper,
      losers,
      source: 'decision',
      sourceOverride: d.source_override,
    } as ResolvedGroup;
  });
}
