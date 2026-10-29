/**
 * #135: duplicate-recipe detection shared by every ingest path.
 *
 * Why: the crawler re-imported the same page through URL variants (`#fragment`,
 * `/print/`, `comment-page-N`, a trailing slash, `?utm_*`) and the Epicurious
 * importer compared untrimmed titles, so `recipes` gained duplicate rows. The
 * only unique keys on `recipes` are `id` and `slug`, and some different recipes
 * share a title, so the rule below needs both a title and a host to call a
 * title match a duplicate.
 * What: two pure normalisers plus `findDuplicateRecipe`, which applies the rule:
 * a candidate duplicates an existing recipe when (a) the canonical source URLs
 * are equal, or (b) the normalised titles are equal AND the source hosts are
 * equal. A title match across different hosts is NOT a duplicate.
 * Test: `src/lib/recipes/__tests__/dedup.test.ts`,
 * `src/app/api/ingest-recipe/__tests__/route-dedup.test.ts`
 */

import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { recipes } from '@/lib/db/schema';

/** Query parameters that only track a visit; they never select a different page. */
const TRACKING_PARAMS = new Set(['fbclid', 'gclid']);
const isTrackingParam = (key: string): boolean => {
  const k = key.toLowerCase();
  return k.startsWith('utm_') || TRACKING_PARAMS.has(k);
};

/** A trailing path segment that only selects another view of the same page. */
const isViewSegment = (segment: string): boolean =>
  segment.toLowerCase() === 'print' || /^comment-page-\d+$/i.test(segment);

/**
 * Normalises a recipe title for equality checks; never for display.
 *
 * Rules: lowercase; strip accents (NFD, then drop combining marks); drop
 * apostrophes; turn every other non-letter, non-digit character into a space;
 * collapse whitespace; trim. `"Grandma's Crème Brûlée! "` → `"grandmas creme brulee"`.
 */
export function normalizeRecipeTitle(title: string | null | undefined): string {
  if (!title) return '';
  return title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['‘’ʼ`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Canonical form of a recipe source URL, for equality checks only.
 *
 * The rules are deliberately conservative: each one removes a part of the URL
 * that selects the same page, never a part that could select a different
 * recipe. Path case and every non-tracking query parameter are kept.
 * - the host is lowercased and a leading `www.` is dropped; a non-default port is kept;
 * - the scheme becomes `https`; user info is dropped;
 * - the fragment is dropped;
 * - `utm_*`, `fbclid` and `gclid` parameters are dropped; the rest are sorted by key, then value;
 * - trailing `print` and `comment-page-N` segments are dropped (`/x/print/`, `/x/comment-page-2`);
 *   the same words in the middle of a path are kept;
 * - a trailing slash is dropped (the bare host keeps no slash).
 *
 * Returns null for input that is not an absolute http(s) URL.
 */
export function canonicalizeSourceUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!host) return null;
  // http's default port is 80; once the scheme is https, port 80 is not a default any more.
  const port = url.port && !(url.protocol === 'http:' && url.port === '80') ? `:${url.port}` : '';

  const segments = url.pathname.split('/');
  while (segments.length > 0 && segments[segments.length - 1] === '') segments.pop();
  while (segments.length > 2 && isViewSegment(segments[segments.length - 1])) {
    segments.pop();
    while (segments.length > 0 && segments[segments.length - 1] === '') segments.pop();
  }
  const path = segments.join('/');

  const params = [...url.searchParams.entries()]
    .filter(([key]) => !isTrackingParam(key))
    .sort(([ka, va], [kb, vb]) => (ka === kb ? cmp(va, vb) : cmp(ka, kb)));
  const query = params.length > 0 ? `?${new URLSearchParams(params).toString()}` : '';

  return `https://${host}${port}${path}${query}`;
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Lowercased hostname without `www.`, or null when the input is not an http(s) URL. */
export function sourceHost(input: string | null | undefined): string | null {
  const canonical = canonicalizeSourceUrl(input);
  return canonical ? new URL(canonical).hostname : null;
}

/** The fields of an existing recipe that the duplicate rule reads. */
export interface ExistingRecipeRef {
  id: string;
  name: string;
  source: string | null;
}

export interface DuplicateMatch {
  id: string;
  name: string;
  source: string | null;
  /** Which half of the rule matched. */
  reason: 'source-url' | 'title-and-host';
}

export interface DuplicateCandidate {
  sourceUrl: string | null | undefined;
  /** Omit to check the source URL only (e.g. before a paid scrape). */
  title?: string | null;
}

/**
 * Applies the duplicate rule to rows already loaded. A source-URL match wins
 * over a title match; within each kind the first row wins, so pass rows oldest first.
 */
export function matchDuplicate(
  candidate: DuplicateCandidate,
  rows: readonly ExistingRecipeRef[]
): DuplicateMatch | null {
  const url = canonicalizeSourceUrl(candidate.sourceUrl);
  if (!url) return null; // no usable source URL: neither half of the rule can apply
  const host = new URL(url).hostname;
  const title = normalizeRecipeTitle(candidate.title);

  let titleMatch: DuplicateMatch | null = null;
  for (const row of rows) {
    const rowUrl = canonicalizeSourceUrl(row.source);
    if (!rowUrl) continue;
    if (rowUrl === url) return { ...pick(row), reason: 'source-url' };
    if (
      !titleMatch &&
      title !== '' &&
      new URL(rowUrl).hostname === host &&
      normalizeRecipeTitle(row.name) === title
    ) {
      titleMatch = { ...pick(row), reason: 'title-and-host' };
    }
  }
  return titleMatch;
}

const pick = ({ id, name, source }: ExistingRecipeRef) => ({ id, name, source });

/** Any drizzle Postgres client: neon-http in production, PGlite in tests. */
export type DedupDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Why: every ingest path must skip a recipe that is already stored (#135).
 * What: loads the live recipes whose `source` is on the candidate's host, then
 * applies `matchDuplicate`. Only recipes the inserting user can already see
 * count: public ones, plus `ownerId`'s own when given. Soft-deleted rows do not
 * count. A hidden (moderation-rejected) public recipe does count, so a
 * re-import cannot bring it back. Returns null when the candidate has no usable
 * source URL.
 * There is no canonical-URL column, so SQL narrows by host with an anchored
 * regex on `lower(source)` (a sequential scan) and JS canonicalises the rest.
 * Test: `src/app/api/ingest-recipe/__tests__/route-dedup.test.ts`
 */
export async function findDuplicateRecipe(
  candidate: DuplicateCandidate,
  options: { ownerId?: string | null; database?: DedupDb } = {}
): Promise<DuplicateMatch | null> {
  const host = sourceHost(candidate.sourceUrl);
  if (!host) return null;
  // '@/lib/db' throws at import when DATABASE_URL is unset, so resolve it lazily.
  const database = options.database ?? ((await import('@/lib/db')).db as unknown as DedupDb);
  const hostPattern = `^\\s*https?://(www\\.)?${escapeRegex(host)}([:/?#]|$)`;
  const visible = options.ownerId
    ? or(eq(recipes.is_public, true), eq(recipes.user_id, options.ownerId))
    : eq(recipes.is_public, true);
  const rows = await database
    .select({ id: recipes.id, name: recipes.name, source: recipes.source })
    .from(recipes)
    .where(and(isNull(recipes.deleted_at), visible, sql`lower(${recipes.source}) ~ ${hostPattern}`))
    .orderBy(asc(recipes.created_at), asc(recipes.id));
  return matchDuplicate(candidate, rows);
}

/** The reason string every ingest path reports for a skipped duplicate. */
export function duplicateSkipReason(match: DuplicateMatch): string {
  return `skipped: duplicate of ${match.id}`;
}
