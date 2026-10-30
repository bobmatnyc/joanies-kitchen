/**
 * #135 (A69): what the apply will do, computed only from the signed dry-run
 * JSON and the signed decisions.
 *
 * Why: the rehearsal compares against `2026-10-30-135-expected-counts.json`,
 * which was read from prod. The apply's own expectations must reproduce it,
 * or one of the two is wrong.
 * What: loser and group counts, soft-deleted and live totals, redirects by id
 * and slug, survivors needing a slug, recipe_views from the per-member view
 * counts, recipe_of_the_day and discovery rows from the dry run's row lists,
 * and (when the dry run carries per-member detail) every per-table count and
 * the unique-key collisions. A figure the dry run cannot support is listed in
 * `notDerivable`, never guessed.
 * Test: `src/lib/recipes/__tests__/dedup-merge-expect.test.ts`
 */
import type { ResolvedGroup } from './dedup-merge-decisions';
import { expectedCollisions, type PinPlan } from './dedup-merge-pin';

/** The dry-run fields read here (all present in every `plan.ts` output). */
export interface ExpectPlan extends PinPlan {
  baseline: { total: number; deleted: number };
  groups: Array<
    PinPlan['groups'][number] & {
      members: Array<{ id: string; slug: string | null; views?: number }>;
    }
  >;
  recipeOfTheDay: Array<Record<string, unknown>>;
  discoveryRunItems: Array<Record<string, unknown>>;
}

export interface Expectations {
  losers: number;
  losersPhase1: number;
  losersPhase2: number;
  groupsWithLosers: number;
  softDeleted: number;
  liveAfter: number;
  redirectsById: number;
  redirectsBySlug: number;
  keepersNullSlug: number;
  views: number;
  recipeOfTheDay: number;
  discoveryRunItems: number;
  /** `table.column` -> rows on post-decision losers; null without per-member detail. */
  tables: Record<string, number> | null;
  /** Collisions by `table.column#index`; null without per-member detail. */
  collisions: Record<string, number> | null;
  /** chef_recipes drops; null when the dry run cannot support the figure. */
  chefCollisions: number | null;
  /** recipe_tools drops on the logical key; null when the dry run predates it. */
  toolCollisions: number | null;
  notDerivable: string[];
}

export function expectFromSigned(
  plan: ExpectPlan,
  resolved: readonly ResolvedGroup[]
): Expectations {
  const merging = resolved.filter((g) => g.losers.length > 0);
  const losers = new Set(merging.flatMap((g) => g.losers));
  const members = new Map<string, { slug: string | null; views?: number }>(
    plan.groups.flatMap((g) => g.members.map((m) => [m.id, m] as const))
  );
  const ruleKeepers = new Set(plan.groups.map((g) => g.keeperId));
  const notDerivable: string[] = [];
  const onLoser = (rows: Array<Record<string, unknown>>) =>
    rows.filter((r) => losers.has(String(r.recipe_id))).length;
  let tables: Record<string, number> | null = null;
  let collisions: Record<string, number> | null = null;
  if (plan.memberRefs && plan.memberKeys) {
    tables = {};
    for (const id of losers) {
      for (const [ref, n] of Object.entries(plan.memberRefs[id] ?? {})) {
        tables[ref] = (tables[ref] ?? 0) + n;
      }
    }
    collisions = {};
    for (const g of merging) {
      for (const c of expectedCollisions(g.keeperId, g.losers, plan.memberKeys)) {
        collisions[c.ref] = (collisions[c.ref] ?? 0) + 1;
      }
    }
  }
  // A dry run that recorded rows on a column but no key values for it predates that key.
  const collisionsOn = (table: string): number | null => {
    if (!collisions || !plan.memberKeys || !plan.memberRefs) return null;
    const prefix = `${table}.recipe_id#`;
    const keyed = Object.values(plan.memberKeys).some((k) =>
      Object.keys(k).some((r) => r.startsWith(prefix))
    );
    const rowsOnLosers = [...losers].some(
      (id) => (plan.memberRefs?.[id]?.[`${table}.recipe_id`] ?? 0) > 0
    );
    if (!keyed && rowsOnLosers) {
      notDerivable.push(`${table} collisions: the dry run recorded no key values for ${table}`);
      return null;
    }
    return Object.entries(collisions)
      .filter(([k]) => k.startsWith(prefix))
      .reduce((n, [, v]) => n + v, 0);
  };
  const chefCollisions = collisionsOn('chef_recipes');
  const toolCollisions = collisionsOn('recipe_tools');
  if (!plan.memberRefs || !plan.memberKeys) {
    // Without detail, RotD and discovery come from the dry run's row lists, which cover
    // rules losers only.
    const wereKeepers = [...losers].filter((id) => ruleKeepers.has(id));
    if (wereKeepers.length) {
      notDerivable.push(
        `recipeOfTheDay/discoveryRunItems omit rows on ${wereKeepers.length} loser(s) that were rules keepers: ${wereKeepers.join(', ')}`
      );
    }
    notDerivable.push(
      'per-table counts and collisions: the dry run has no per-member detail (memberRefs/memberKeys)'
    );
  }
  const live = plan.baseline.total - plan.baseline.deleted;
  return {
    losers: losers.size,
    losersPhase1: merging.filter((g) => g.phase === 1).reduce((n, g) => n + g.losers.length, 0),
    losersPhase2: merging.filter((g) => g.phase === 2).reduce((n, g) => n + g.losers.length, 0),
    groupsWithLosers: merging.length,
    softDeleted: losers.size,
    liveAfter: live - losers.size,
    redirectsById: losers.size,
    redirectsBySlug: [...losers].filter((id) => members.get(id)?.slug).length,
    keepersNullSlug: merging.filter((g) => members.get(g.keeperId)?.slug === null).length,
    views: [...losers].reduce((n, id) => n + (members.get(id)?.views ?? 0), 0),
    recipeOfTheDay: tables
      ? (tables['recipe_of_the_day.recipe_id'] ?? 0)
      : onLoser(plan.recipeOfTheDay),
    discoveryRunItems: tables
      ? (tables['recipe_discovery_run_items.recipe_id'] ?? 0)
      : onLoser(plan.discoveryRunItems),
    tables,
    collisions,
    chefCollisions,
    toolCollisions,
    notDerivable,
  };
}
