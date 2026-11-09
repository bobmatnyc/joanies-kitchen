/**
 * URL rules the autonomous crawl applies before and between fetches (#302).
 *
 * Why: the 2026-11-09 cron run spent 51% of its 270s on index, media, forum
 * and listicle pages that no tier could turn into a recipe, and 26s on a
 * fixed pause between URLs on different hosts.
 * What: `nonRecipePathRule` names the rule a URL path breaks, or null;
 * `needsHostDelay` says whether two consecutive URLs share a host;
 * `skipsFirecrawlTier` says which run type skips the Firecrawl tier.
 * Test: `src/lib/services/__tests__/cron-tier-speedups-302.test.ts`
 */

import type { DiscoveryRunType } from './discovery-run-store';

/** Pause between two consecutive extractions on the same host. */
export const EXTRACTION_DELAY_MS = 2000;

/** Path segments that only appear on index, media and forum pages. */
const NON_RECIPE_SEGMENTS = new Map<string, string>([
  ['blog-categories', 'index-path'],
  ['category', 'index-path'],
  ['tag', 'index-path'],
  ['tags', 'index-path'],
  ['story', 'media-path'],
  ['watch', 'media-path'],
  ['television', 'media-path'],
  ['video', 'media-path'],
  ['videos', 'media-path'],
  ['forum', 'forum-thread'],
  ['forums', 'forum-thread'],
  ['threads', 'forum-thread'],
]);

const INTERVIEW_SLUG = /(?:^|-)interviews?(?:-|$)/;
const ROUNDUP_SLUG = /(?:^|-)round-?ups?(?:-|$)/;
/**
 * #302: `15-creative-uses-...`, `10-best-brownies`: a 1-3 digit count with list
 * wording within three words after it. A count alone (`40-clove-garlic-chicken`,
 * `7-up-cake`, `5-minute-hummus`) is a recipe name; compare LISTICLE_URL_PATTERNS
 * in recipe-discovery-url.ts.
 */
const LISTICLE_SLUG =
  /^\d{1,3}-(?:[a-z0-9]+-){0,3}(?:best|ways|uses|ideas|things|tips|tricks|hacks|recipes|reasons|foods|dishes|meals|dinners|snacks|desserts)(?:-|$)/;

/**
 * Why: these pages hold no recipe, and each one cost 7-34s of tier calls (#302).
 * What: returns the rule a URL's path breaks (`index-path`, `media-path`,
 * `forum-thread`, `interview`, `roundup`, `listicle`), or null when the path
 * may hold a recipe. Reads the path only, lower-cased; an unparseable URL
 * returns null and is left to the fetch.
 * Test: `rejects every #302 non-recipe path`, `passes real recipe paths`
 */
export function nonRecipePathRule(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }
  const segments = pathname.split('/').filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const next = segments[i + 1];
    const rule = NON_RECIPE_SEGMENTS.get(seg);
    if (rule) return rule;
    if (seg === 'blog' && next === 'c') return 'index-path'; // /blog/c/<category>
    if (seg === 't' && next !== undefined && /^\d+$/.test(next)) return 'forum-thread';
    if (INTERVIEW_SLUG.test(seg)) return 'interview';
    if (ROUNDUP_SLUG.test(seg)) return 'roundup';
    if (LISTICLE_SLUG.test(seg)) return 'listicle';
  }
  return null;
}

/** Host without a leading `www.`, lower-cased; null for an unparseable URL. */
function siteHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Why: the pause protects one site from back-to-back fetches; between two
 * hosts it only spends the run's time (#302).
 * What: true when both URLs are on the same host (`www.` ignored), or when
 * either host cannot be read, so an unknown pair keeps the pause.
 * Test: `delays only between URLs on the same host`
 */
export function needsHostDelay(current: string, next: string): boolean {
  const a = siteHost(current);
  const b = siteHost(next);
  return a === null || b === null || a === b;
}

/**
 * #302: only the scheduled cron (`daily`) skips the Firecrawl tier, whose
 * schema read never returned data there; manual and local runs keep it.
 */
export function skipsFirecrawlTier(runType: DiscoveryRunType): boolean {
  return runType === 'daily';
}
