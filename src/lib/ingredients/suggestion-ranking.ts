/**
 * Ranking, dedup and category correction for ingredient autocomplete.
 *
 * Why: the DB returns candidates ordered by `is_common, name`, so substring
 * matches outrank exact/prefix matches and near-duplicate rows (case or plural
 * variants) all surface. Pure so it is unit-testable without a database.
 * Test: `src/app/actions/__tests__/ingredient-suggestions.test.ts`
 */

export interface RankableSuggestion {
  id: string;
  name: string;
  displayName: string;
  category: string | null;
  isCommon: boolean;
}

// #47: stocks and broths get their own category; the LLM extraction prompt had
// no fitting choice and filed some of them under 'dairy' or 'proteins'.
export const STOCK_CATEGORY = 'stocks';
const STOCK_PATTERN = /\b(stocks?|broths?|bouillon|consomm[eé])\b/i;

/** Returns the category to show for an ingredient, correcting known misfiles. */
export function correctSuggestionCategory(name: string, category: string | null): string | null {
  // #47: never show a stock or broth as Dairy (or Proteins).
  if (STOCK_PATTERN.test(name)) return STOCK_CATEGORY;
  return category;
}

/** Lowercase, collapse separators, and strip a simple English plural. */
export function suggestionDedupKey(value: string): string {
  const words = value
    .toLowerCase()
    .replace(/[-_\s]+/g, ' ')
    .trim()
    .split(' ');
  const last = words.pop() ?? '';
  let singular = last;
  if (/ies$/.test(last) && last.length > 4) singular = `${last.slice(0, -3)}y`;
  else if (/(oes|ches|shes|sses|xes)$/.test(last)) singular = last.slice(0, -2);
  else if (/[^s]s$/.test(last) && last.length > 3) singular = last.slice(0, -1);
  return [...words, singular].join(' ');
}

/** 0 = exact, 1 = prefix, 2 = word prefix, 3 = substring/alias match. */
function matchTier(s: RankableSuggestion, query: string): number {
  const q = suggestionDedupKey(query);
  let best = 3;
  for (const field of [s.name, s.displayName]) {
    const v = field.toLowerCase().replace(/[-_\s]+/g, ' ').trim();
    const key = suggestionDedupKey(field);
    if (key === q || v === query) return 0;
    if (v.startsWith(query) || key.startsWith(q)) best = Math.min(best, 1);
    else if (v.split(' ').some((w) => w.startsWith(query))) best = Math.min(best, 2);
  }
  return best;
}

/**
 * Why: issue #47 — exact and prefix matches must rank above substring matches,
 * and the list must not repeat an ingredient.
 * What: sorts by match tier, then common-first, then shorter name, then
 * alphabetical; drops repeated ids and repeated dedup keys (keeping the
 * best-ranked row); corrects categories; truncates to `limit`.
 * Test: `src/app/actions/__tests__/ingredient-suggestions.test.ts`
 */
export function rankAndDedupeSuggestions<T extends RankableSuggestion>(
  rows: T[],
  query: string,
  limit: number
): T[] {
  const q = query.toLowerCase().replace(/[-_\s]+/g, ' ').trim();
  const ranked = rows
    .map((row) => ({ row, tier: matchTier(row, q) }))
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        Number(b.row.isCommon) - Number(a.row.isCommon) ||
        a.row.displayName.length - b.row.displayName.length ||
        a.row.displayName.localeCompare(b.row.displayName, 'en', { caseFirst: 'upper' }) // keep the capitalized variant
    );

  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const out: T[] = [];
  for (const { row } of ranked) {
    const key = suggestionDedupKey(row.displayName || row.name);
    if (seenIds.has(row.id) || seenKeys.has(key)) continue;
    seenIds.add(row.id);
    seenKeys.add(key);
    out.push({ ...row, category: correctSuggestionCategory(row.displayName || row.name, row.category) });
    if (out.length >= limit) break;
  }
  return out;
}
