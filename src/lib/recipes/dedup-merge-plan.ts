/**
 * #135: pure planning rules for merging existing duplicate recipes.
 *
 * Why: 961 duplicate groups exist in production (report
 * `.trusty-mpm/runbooks/2026-10-29-duplicate-recipes-report.md`, §2–§7). The
 * merge needs one keeper per group, picked by fixed rules, before any row moves.
 * What: the report's title key (as SQL), group categorisation (A1/A2/B1/B2/C),
 * keeper selection, the review flag, and the unique-key collision count for
 * re-pointing rows. No I/O; `scripts/dedup-135/plan.ts` feeds it live rows.
 * Test: `src/lib/recipes/__tests__/dedup-merge-plan.test.ts`
 */

/** One recipe inside a duplicate group, with the counts the keeper rule reads. */
export interface GroupMember {
  id: string;
  name: string;
  slug: string | null;
  userId: string | null;
  source: string | null;
  /** UTC creation time. */
  createdAt: Date;
  views: number;
  /** favorites + collection_recipes + meal_recipes + ratings + comments + likes. */
  userRefs: number;
  /** md5 of the stored `ingredients` text. */
  ingredientsHash: string;
  /** md5 of the stored `instructions` text. */
  instructionsHash: string;
}

export type GroupCategory = 'A1' | 'A2' | 'B1' | 'B2' | 'C';

export interface KeeperChoice {
  keeperId: string;
  /** One line naming the rule that decided. */
  reason: string;
}

const EPICURIOUS_USER = 'system_imported';
const EPICURIOUS_SOURCE = 'epicurious.com';
const EPICURIOUS_ORIGINAL_DAY = '2025-10-15';
const EPICURIOUS_RERUN_DAY = '2025-10-18';

const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

const isEpicuriousBatch = (m: GroupMember, day: string): boolean =>
  m.userId === EPICURIOUS_USER && m.source === EPICURIOUS_SOURCE && utcDay(m.createdAt) === day;

/** A row from the 2025-10-15 Epicurious import (the row of record). */
export const isEpicuriousOriginal = (m: GroupMember): boolean =>
  isEpicuriousBatch(m, EPICURIOUS_ORIGINAL_DAY);

/** A row from the 2025-10-18 Epicurious re-run (trailing-space name, NULL slug). */
export const isEpicuriousRerun = (m: GroupMember): boolean =>
  isEpicuriousBatch(m, EPICURIOUS_RERUN_DAY);

/** A group holding both an Epicurious original and its 2025-10-18 re-run copy. */
export const isEpicuriousTwinGroup = (members: readonly GroupMember[]): boolean =>
  members.some(isEpicuriousOriginal) && members.some(isEpicuriousRerun);

const allEqual = <T>(values: readonly T[]): boolean => values.every((v) => v === values[0]);

/**
 * Report §3: A1 content and source identical; A2 content identical, source
 * differs; B1/B2 Epicurious twin groups whose instructions are / are not all
 * identical; C everything else (different content, no Epicurious twin).
 */
export function categorizeGroup(members: readonly GroupMember[]): GroupCategory {
  const sameIngredients = allEqual(members.map((m) => m.ingredientsHash));
  const sameInstructions = allEqual(members.map((m) => m.instructionsHash));
  if (sameIngredients && sameInstructions) {
    return allEqual(members.map((m) => m.source ?? null)) ? 'A1' : 'A2';
  }
  if (isEpicuriousTwinGroup(members)) return sameInstructions ? 'B1' : 'B2';
  return 'C';
}

/** Report §7: category C and every group of 3 or more need a person's check. */
export const needsReview = (category: GroupCategory, size: number): boolean =>
  category === 'C' || size >= 3;

const byCreatedThenId = (a: GroupMember, b: GroupMember): number =>
  a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Rule 2 order: user refs desc, views desc, has slug first, oldest, then id. */
export function compareKeeperCandidates(a: GroupMember, b: GroupMember): number {
  return (
    b.userRefs - a.userRefs ||
    b.views - a.views ||
    Number(b.slug !== null) - Number(a.slug !== null) ||
    byCreatedThenId(a, b)
  );
}

function decidingCriterion(winner: GroupMember, runnerUp: GroupMember): string {
  if (winner.userRefs !== runnerUp.userRefs) {
    return `most user references (${winner.userRefs} vs ${runnerUp.userRefs})`;
  }
  if (winner.views !== runnerUp.views) return `most views (${winner.views} vs ${runnerUp.views})`;
  if ((winner.slug !== null) !== (runnerUp.slug !== null)) {
    return `refs and views tied (${winner.userRefs}/${winner.views}); only one with a slug`;
  }
  if (winner.createdAt.getTime() !== runnerUp.createdAt.getTime()) {
    return `refs, views and slug tied (${winner.userRefs}/${winner.views}); oldest`;
  }
  return 'all criteria tied; lowest id';
}

/**
 * Why: the keeper keeps the public URL and receives every re-pointed row, so
 * the choice must be deterministic and explainable (report §7).
 * What: an Epicurious twin group keeps its oldest 2025-10-15 original. Any
 * other group keeps the first member under `compareKeeperCandidates`. The
 * reason names the criterion that separated the keeper from the runner-up.
 * Test: `src/lib/recipes/__tests__/dedup-merge-plan.test.ts`
 */
export function selectKeeper(members: readonly GroupMember[]): KeeperChoice {
  if (members.length < 2) throw new Error('a duplicate group has at least 2 members');
  if (isEpicuriousTwinGroup(members)) {
    const originals = members.filter(isEpicuriousOriginal).sort(byCreatedThenId);
    const extra = originals.length > 1 ? ` (oldest of ${originals.length} originals)` : '';
    return { keeperId: originals[0].id, reason: `Epicurious twin: 2025-10-15 original${extra}` };
  }
  const [winner, runnerUp] = [...members].sort(compareKeeperCandidates);
  return { keeperId: winner.id, reason: decidingCriterion(winner, runnerUp) };
}

/**
 * Report §2 title key, as a SQL expression over `col`: lower, Latin accents to
 * ASCII via translate (unaccent is not installed), ß/æ/œ expanded, apostrophes
 * and backticks removed, every non-[a-z0-9] run to one space, trimmed.
 */
export function titleKeySql(col: string): string {
  const map: Array<[string, string]> = [
    ['a', 'àáâãäåāăą'],
    ['c', 'çćč'],
    ['d', 'ďđ'],
    ['e', 'èéêëēěę'],
    ['i', 'ìíîïīį'],
    ['n', 'ñńň'],
    ['o', 'òóôõöøōő'],
    ['u', 'ùúûüūůűų'],
    ['y', 'ýÿ'],
    ['z', 'žźż'],
    ['s', 'śš'],
    ['t', 'ť'],
    ['l', 'ł'],
  ];
  const from = map.map(([, src]) => src).join('');
  const to = map.map(([dst, src]) => dst.repeat([...src].length)).join('');
  const translated = `translate(lower(${col}), '${from}', '${to}')`;
  const expanded = `replace(replace(replace(${translated}, 'ß', 'ss'), 'æ', 'ae'), 'œ', 'oe')`;
  const noApostrophes = `regexp_replace(${expanded}, '[''’\`]', '', 'g')`;
  return `btrim(regexp_replace(${noApostrophes}, '[^a-z0-9]+', ' ', 'g'))`;
}

/** A row of a unique-constrained table: the FK value plus the other key columns. */
export interface KeyedRow {
  recipeId: string;
  /** Values of the unique key's other columns, in a fixed order. */
  otherKey: ReadonlyArray<string | null>;
}

export interface RepointCount {
  /** Loser rows that would move to a keeper. */
  repoint: number;
  /** Of those, rows whose key already exists on the keeper (or on an earlier moved row). */
  collisions: number;
}

/**
 * Counts loser rows to re-point and how many would break the unique key
 * `(recipe_id, ...otherKey)` once moved. A key holding a NULL never collides
 * (Postgres treats NULLs as distinct). Proposed handling for a collision:
 * drop the loser's row, keep the keeper's.
 */
export function countRepointCollisions(
  rows: readonly KeyedRow[],
  keeperOf: ReadonlyMap<string, string>
): RepointCount {
  const keyOf = (recipeId: string, other: KeyedRow['otherKey']): string | null =>
    other.some((v) => v === null) ? null : JSON.stringify([recipeId, ...other]);
  const taken = new Set<string>();
  const keepers = new Set(keeperOf.values());
  for (const r of rows) {
    const k =
      keepers.has(r.recipeId) && !keeperOf.has(r.recipeId) ? keyOf(r.recipeId, r.otherKey) : null;
    if (k) taken.add(k);
  }
  let repoint = 0;
  let collisions = 0;
  for (const r of rows) {
    const keeper = keeperOf.get(r.recipeId);
    if (!keeper) continue;
    repoint++;
    const k = keyOf(keeper, r.otherKey);
    if (k === null) continue;
    if (taken.has(k)) collisions++;
    else taken.add(k);
  }
  return { repoint, collisions };
}
