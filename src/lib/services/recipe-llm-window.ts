/**
 * #314: chooses which part of a scraped page the LLM structuring step reads.
 *
 * The step used to send the first 12,000 chars. On long blog posts the recipe
 * card sits past that cut, behind prose, so the LLM saw no recipe. This module
 * keeps the same 12,000-char budget but spends it on a small head slice (title,
 * description) plus a window anchored on the recipe card.
 */

/** Total chars of page content sent to the LLM; unchanged from before #314. */
export const LLM_CONTENT_CAP = 12000;
/** Head slice kept for the title and description (Jina puts `Title:` first). */
const HEAD_CHARS = 1500;
/** Chars kept before the card anchor, for the card title above its metadata. */
const LEAD_CHARS = 500;
/** How far before the first ingredient run a card marker may sit. */
const MARKER_LOOKBACK = 3000;
/** Ingredient-like lines needed within `RUN_SPAN` non-blank lines to call it a list. */
const RUN_MIN = 3;
const RUN_SPAN = 8;
const GAP = '\n\n[... page content omitted ...]\n\n';

// Recipe-card plugin markup and JSON-LD Recipe, when the scraper keeps raw HTML or scripts.
const PLUGIN_MARKER =
  /wprm-recipe|tasty-recipes|mv-create-card|jetpack-recipe|"@type"\s*:\s*\[?\s*"Recipe"/i;
// A section heading (markdown, bold or bare line) that opens a recipe card section.
const HEADING_MARKER =
  /^[ \t]*(?:#{1,6}[ \t]*|\*\*)?(?:ingredients?|instructions?|directions?|method)\b[^\n]{0,30}$/im;
// Card metadata lines: "**Servings:**", "Yield: 4", "Prep Time: 10 min".
const META_MARKER =
  /^[ \t]*(?:[*-][ \t]+)?(?:\*\*)?(?:servings?|serves|yields?|prep time|cook time|total time)\b/im;
// An ingredient line: optional bullet, a quantity, then a unit or size word.
const INGREDIENT_LINE =
  /^[ \t]*(?:[*•-][ \t]+)?(?:\d+(?:[ \t]+\d+)?(?:[/.]\d+)?|[½¼¾⅓⅔⅛])[ \t]*(?:\([^)]{0,30}\)[ \t]*)?(?:cups?|tablespoons?|teaspoons?|tbsps?|tsps?|grams?|g|kg|ounces?|oz|pounds?|lbs?|ml|liters?|litres?|quarts?|pints?|cloves?|pinch(?:es)?|large|medium|small|cans?|sticks?|sprigs?|slices?|eggs?|bunch(?:es)?)\b/i;

/** Offset of the first line of the first ingredient-dense run, or -1. */
function firstIngredientRun(content: string): number {
  const lines: { start: number; hit: boolean }[] = [];
  let start = 0;
  for (const line of content.split('\n')) {
    if (line.trim()) lines.push({ start, hit: line.length <= 200 && INGREDIENT_LINE.test(line) });
    start += line.length + 1;
  }
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].hit) continue;
    const span = lines.slice(i, i + RUN_SPAN);
    if (span.filter((l) => l.hit).length >= RUN_MIN) return lines[i].start;
  }
  return -1;
}

/** Offset of the first match of `re` in `content` at or after `from`, or -1. */
function indexFrom(content: string, re: RegExp, from: number): number {
  const m = re.exec(content.slice(from));
  return m ? from + m.index : -1;
}

/**
 * Offset where the recipe card starts, or -1 when the page shows none.
 * The earliest of: the first plugin or section-heading marker on the page, and
 * the first ingredient-dense run moved back to the earliest card marker
 * (metadata line, section heading, plugin markup) within `MARKER_LOOKBACK`.
 */
export function findRecipeAnchor(content: string): number {
  // #314: a produce-only card ("2 onions") has no unit run; its heading must
  // still win over a unit run later on the page (reader comments, related posts).
  const anchors = [PLUGIN_MARKER, HEADING_MARKER]
    .map((re) => indexFrom(content, re, 0))
    .filter((i) => i >= 0);
  const run = firstIngredientRun(content);
  if (run >= 0) {
    const from = Math.max(0, run - MARKER_LOOKBACK);
    const near = [META_MARKER, HEADING_MARKER, PLUGIN_MARKER]
      .map((re) => indexFrom(content, re, from))
      .filter((i) => i >= 0 && i <= run);
    anchors.push(run, ...near);
  }
  return anchors.length ? Math.min(...anchors) : -1;
}

/**
 * Why: a recipe card past the first 12,000 chars never reached the LLM, so real
 * recipes were skipped as non-recipe (#314, smittenkitchen on the 11-11 run).
 * What: returns `content` unchanged when it fits in `cap`. Otherwise returns a
 * head slice plus a window that starts `LEAD_CHARS` before the recipe anchor,
 * joined by a gap marker; total length is at most `cap`. With no anchor, or an
 * anchor close enough that the head and window overlap, it returns the first
 * `cap` chars, as before.
 * Test: `src/lib/services/__tests__/recipe-extraction-llm-window-314.test.ts`
 */
export function selectLlmContent(content: string, cap = LLM_CONTENT_CAP): string {
  if (content.length <= cap) return content;
  const anchor = findRecipeAnchor(content);
  const window = cap - HEAD_CHARS - GAP.length;
  if (anchor < 0) return content.slice(0, cap);
  // Use the whole budget near the end of the page; start on a line boundary.
  let start = Math.min(anchor - LEAD_CHARS, content.length - window);
  // #314: snap forward, never back, so an end-clamped window still reaches the page end.
  const nextLine = content.indexOf('\n', start - 1) + 1;
  if (nextLine > 0 && nextLine - start < 200) start = nextLine;
  if (start <= HEAD_CHARS) return content.slice(0, cap);
  return `${content.slice(0, HEAD_CHARS)}${GAP}${content.slice(start, start + window)}`;
}
