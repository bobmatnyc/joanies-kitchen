/**
 * #12: coercion for the integer recipe columns (`servings`, `prep_time`,
 * `cook_time`). Scraped and LLM-extracted values arrive as free text
 * ("4 to 6", "8-12", "3 quarts"); a raw string in an integer column fails the
 * whole INSERT with Postgres 22P02.
 */

/** Largest value a Postgres `integer` column accepts. */
const PG_INT_MAX = 2_147_483_647;

/**
 * Why: every recipe insert path must write an integer or null to the integer
 * columns, whatever shape the extractor produced (#12).
 * What: returns a positive integer or null.
 * - Numbers: truncated toward zero (2.7 → 2).
 * - Strings: the first number in the text, same rule as the JSON-LD
 *   `recipeYield` coercion — "4 to 6" → 4, "8-12" → 8, "Serves 4" → 4.
 *   A quantity with a unit keeps its number: "3 quarts" → 3. The column holds
 *   a count, and the leading figure is the best count the text offers.
 * - Text with no digits ("a crowd"), empty, null/undefined → null.
 * - Zero, negatives ("-3"), non-finite, or values above Postgres int4 → null.
 * Test: `src/lib/utils/__tests__/recipe-int.test.ts`
 */
export function toRecipeInt(value: unknown): number | null {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    // #12: a minus counts only when it touches the digits, so "Prep - 30 min" → 30.
    // A range "8-12" is safe: the scan stops at 8 before reaching "-12".
    const match = value.match(/(-?)(\d+(?:\.\d+)?)/);
    if (!match) return null;
    n = Number(`${match[1]}${match[2]}`);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  return int > 0 && int <= PG_INT_MAX ? int : null;
}
