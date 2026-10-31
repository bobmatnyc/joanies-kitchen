/**
 * Pull the first complete JSON object out of a model reply.
 *
 * #216: a chat model asked for "ONLY a JSON object" still sometimes wraps it in
 * a ```json fence, prefixes prose, or appends a note or a second object. A
 * greedy `/\{[\s\S]*\}/` spans from the first `{` to the LAST `}`, so trailing
 * text holding a brace made JSON.parse fail with "Unexpected non-whitespace
 * character after JSON".
 */

/**
 * Why: model replies carry text around the JSON the caller asked for (#216).
 * What: scans from the first `{` to its matching `}` — tracking string
 *   literals and backslash escapes so braces inside strings do not count — and
 *   JSON.parses exactly that span. Text before and after the span is ignored.
 *   Throws when the reply has no `{`, when the object never closes (truncated
 *   reply), or when the balanced span is not valid JSON. It never returns a
 *   default, so a bad reply fails closed and the caller's validation still runs.
 * Test: `extract-first-json.test.ts`, `recipe-extraction-json-216.test.ts`
 */
export function extractFirstJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  if (start === -1) {
    throw new Error('Model reply contains no JSON object');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        // JSON.parse reports malformed content inside the span (e.g. a
        // mismatched `]`), so the scanner only needs to find where it ends.
        return JSON.parse(text.slice(start, i + 1));
      }
    }
  }

  throw new Error('Model reply contains an incomplete JSON object (truncated?)');
}
