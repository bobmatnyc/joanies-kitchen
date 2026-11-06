/**
 * #111: build the Tier1/Firecrawl failure warn line so a 403 can be told apart
 * (auth vs quota vs site block). Logs host+path only, status, and a short
 * cause; never the query string, API key, or request headers.
 */

const CAUSE_MAX = 200;

/** Error carrying the Firecrawl status and response `error` text. */
export class FirecrawlHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly causeText?: string
  ) {
    super(`HTTP ${statusCode} from Firecrawl`);
  }
}

/** Host + path of a URL, query and fragment stripped. */
export function safeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

function clip(text: string, apiKey?: string): string {
  let out = text.replace(/\s+/g, ' ').trim();
  if (apiKey) out = out.split(apiKey).join('[redacted]');
  return out.length > CAUSE_MAX ? `${out.slice(0, CAUSE_MAX)}…` : out;
}

/** Formats the warn line for a failed Firecrawl tier. */
export function formatFirecrawlFailure(url: string, error: unknown, apiKey?: string): string {
  const msg = error instanceof Error ? error.message : String(error);
  const e = (error ?? {}) as { statusCode?: unknown; status?: unknown; code?: unknown };
  const status = e.statusCode ?? e.status;
  const parts = [`url=${safeUrl(url)}`];
  if (typeof status === 'number') parts.push(`status=${status}`);
  let cause: string | undefined;
  if (error instanceof FirecrawlHttpError) cause = error.causeText;
  else if (typeof e.code === 'string') cause = `${e.code}: ${msg}`;
  if (cause) parts.push(`cause="${clip(cause, apiKey)}"`);
  return `[RecipeExtraction] Tier1/Firecrawl failed: ${clip(msg, apiKey)} (${parts.join(', ')})`;
}
