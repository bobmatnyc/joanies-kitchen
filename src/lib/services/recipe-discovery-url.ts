/**
 * Recipe discovery URL classifier (#298: moved from recipe-discovery.service.ts).
 *
 * Pure URL rules: single-recipe validity, listicle/hub detection and domain
 * extraction. RecipeDiscoveryService delegates its classifier methods here.
 */

import { ALLOWED_DOMAINS, BLOCKED_DOMAINS } from './recipe-discovery-sources';

/**
 * URL patterns that indicate a recipe page
 */
const RECIPE_URL_INDICATORS = [
  '/recipe/',
  '/recipes/',
  '-recipe',
  '_recipe',
  '/how-to-make',
  '/cooking/',
  '/dish/',
];

/**
 * URL patterns that always indicate non-recipe pages to skip.
 * Checked before allowed-domain logic so they are excluded everywhere.
 */
const NON_RECIPE_URL_PATTERNS = [
  '/author/',
  '/by/',
  '/profile/',
  '/bio',
  '/about',
  '/tag/',
  '/category/',
  '/search',
  '/contributor/',
  '/writers/',
  '/staff/',
  '/team/',
  '/news/',
  '/article/',
];

/**
 * Path segments that identify non-recipe structural/promo pages.
 * Applies to ALL domains (including allowed ones).
 */
const NON_RECIPE_PATH_SEGMENTS = [
  'recipe-index',
  'recipe-list',
  'recipe-archive',
  'cookbook',
  'book',
  'shop',
  'subscribe',
  'newsletter',
  'gift',
  'bundle',
  'press',
  'media',
  'events',
  'classes',
  'workshops',
  'index',
];

/**
 * URL path substrings (non-segment) for clearly-non-recipe pages.
 * Note: '-cookbook' catches compound slugs like /zero-waste-chef-cookbook.
 * Note: '-book-is-here' catches the specific production offender
 *   /zero-waste-chef-book-is-here (book promo page).
 *   The former '-book-' entry was removed — it was too broad and would reject
 *   legitimate recipe slugs like /recipes/slow-cooker-book-club-bread.
 * Note: '-recipe-bundle' catches /bonus-recipe-bundle and
 *   /2021/03/09/bonus-recipe-bundle without colliding with generic '-bundle'
 *   slugs that may legitimately appear in recipe names.
 */
const NON_RECIPE_PATH_SUBSTRINGS = [
  'recipe-index',
  '/cookbook',
  '-cookbook',
  '/the-book',
  '/buy-the-book',
  '-book-is-here',
  '/shop/',
  '/shop?',
  '/subscribe',
  '/gift',
  '-recipe-bundle',
  '/bonus-',
  '/promo',
  '/landing',
  '/press',
];

/**
 * Title and URL patterns that indicate a listicle / roundup page.
 * These pages contain LINKS to recipes rather than being a single recipe.
 */
const LISTICLE_TITLE_PATTERNS: RegExp[] = [
  /\b\d+\s+(?:easy\s+|quick\s+|healthy\s+|vegan\s+|simple\s+)?recipes?\b/i,
  /\brecipes\s+(?:to|that|for|you|we)\b/i,
  // PLURAL-ONLY: "best ... recipes" (plural) signals a roundup; singular "recipe" is fine.
  // Changed from /\bbest\s+.{0,30}recipes?\b/i — the ? caused false positives on
  // single-recipe titles like "Best Banana Bread Recipe".
  /\bbest\s+.{0,30}\brecipes\b/i,
  /\btop\s+\d+\s+recipes?\b/i,
  /\broundup\b/i,
  /\brecipe\s+roundup\b/i,
  /\bweekly\s+menu\b/i,
  /\bmeal\s+plan\b/i,
  /\bfavorite\s+recipes?\b/i,
  /\bcollection\s+of\s+recipes?\b/i,
  /\brecipes?\s+collection\b/i,
  // NOTE: /\bultimate\s+(?:guide|list)\b/i was removed — it flagged legitimate
  // single-recipe how-to pages like "Ultimate Guide to Sourdough Bread".
  /\b(?:dietitian|nutritionist)-approved\s+recipes?\b/i,
];

const LISTICLE_URL_PATTERNS: RegExp[] = [
  /\/\d+-(?:\w+-)*recipes(?:[-/]|$)/i,
  /\/(?:best|top|easy|healthy|quick|vegan)-\w+-recipes(?:[-/]|$)/i,
  /\/recipes-(?:to|that|for|you)\b/i,
  /\/roundup\b/i,
  /\/recipe-roundup\b/i,
  /\/\d+-sustainable/i,
  /\/\d+-zero-waste/i,
  /\/\d+-dietitian/i,
  /\/blog\/\w+-recipes?(?:[-/]|$)/i,
];

/**
 * URL patterns that identify DEFINITIVE hub/category/index pages — structural
 * pages that aggregate child recipe links and are never themselves single recipes.
 * These are routed through harvestChildLinksFromListicle with NO fallback to
 * single-recipe extraction.
 *
 * Covered shapes:
 *   /blogs/<segment(s)>       — Shopify-style blog category/roundup paths
 *                               (e.g. cabotcreamery.com/blogs/food/root-stem-recipes)
 *   /recipes-categories/<slug> — recipe category hub (e.g. lidiasitaly.com/recipes-categories/main-dishes)
 *   /recipe-category/<slug>   — alternate WP category path
 *   /recipes/category/<slug>  — WP-style recipes category
 */
const HUB_URL_PATTERNS: RegExp[] = [
  // /blogs/<segment(s)> — any /blogs/ path with at least one slug segment
  /\/blogs\/[^/]+(?:\/[^/]+)*/i,
  // /recipes-categories/<slug>
  /\/recipes-categories\/[^/]+/i,
  // /recipe-category/<slug>
  /\/recipe-category\/[^/]+/i,
  // /recipes/category/<slug>
  /\/recipes\/category\/[^/]+/i,
];

/**
 * URL patterns for /blog/<slug> paths — these are "ambiguous" pages that may be
 * either a single recipe post OR a blog roundup/index. Attempt harvest first;
 * if no child recipe links are found, fall back to single-recipe extraction.
 * Matches a /blog/ segment followed by exactly one slug (not /blog/ bare or
 * date-nested paths that already have recipe context).
 */
const BLOG_SLUG_PATTERN = /^\/blog\/([^/]+)\/?$/i;

/**
 * Domains where recipe pages are published under date-based URL paths
 * (e.g. /YYYY/MM/DD/slug or /YYYY/MM/slug). On these domains, a bare
 * single-segment path (e.g. /sourdough, /fermentation) is a category/tag
 * index page, NOT a single recipe — it should be harvested for child links.
 */
const DATE_STRUCTURED_RECIPE_DOMAINS = new Set(['zerowastechef.com']);

/**
 * Classify a URL as a listicle/roundup/hub page that should be harvested
 * for child recipe links rather than extracted as a single recipe.
 *
 * Returns true for:
 * - Classic listicle URL patterns (e.g. /20-vegan-recipes)
 * - Definitive structural hub pages (HUB_URL_PATTERNS): /blogs/<segments>,
 *   /recipes-categories/<slug>, /recipe-category/<slug>
 * - Ambiguous /blog/<slug> paths (may be roundup OR single recipe — see
 *   discoverRecipeUrls fallback logic for the distinction)
 * - Bare single-segment paths on date-structured domains (e.g. zerowastechef.com/sourdough)
 * - Title-based listicle patterns (e.g. "30 sustainable recipes")
 */
export function isListiclePage(url: string, title?: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const pathname = parsed.pathname.toLowerCase();
  const hostname = parsed.hostname.toLowerCase().replace('www.', '');

  if (LISTICLE_URL_PATTERNS.some((p) => p.test(pathname))) return true;
  if (HUB_URL_PATTERNS.some((p) => p.test(pathname))) return true;
  if (BLOG_SLUG_PATTERN.test(pathname)) return true;

  // Bare single-segment paths on date-structured domains are category/tag hubs
  if (DATE_STRUCTURED_RECIPE_DOMAINS.has(hostname) && isBareSingleSegmentPath(pathname))
    return true;

  if (title && LISTICLE_TITLE_PATTERNS.some((p) => p.test(title))) return true;

  return false;
}

/**
 * Returns true if pathname has exactly one non-empty segment with no date structure.
 * e.g. /sourdough → true; /2023/01/sourdough → false; /recipes/soup → false
 */
function isBareSingleSegmentPath(pathname: string): boolean {
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);
  if (segments.length !== 1) return false;
  // Exclude if the segment looks like a year (date-based path start)
  if (/^\d{4}$/.test(segments[0])) return false;
  return true;
}

/**
 * Returns true for DEFINITIVE structural hub/category pages — these are never
 * single recipe pages and have no fallback to single-recipe extraction.
 * Subset of isListiclePage() — only the structural HUB_URL_PATTERNS.
 *
 * Contrast with /blog/<slug> paths (matched by BLOG_SLUG_PATTERN) which are
 * "ambiguous" and DO have a single-recipe fallback in discoverRecipeUrls.
 */
export function isHubPage(url: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return false;
  }
  return HUB_URL_PATTERNS.some((p) => p.test(pathname));
}

/**
 * Validate a URL as a likely single-recipe page.
 *
 * Rejects:
 * - Blocked domains (paywalled, known-blockers)
 * - Standard non-recipe path patterns (/author/, /tag/, etc.)
 * - Non-recipe structural/promo paths on ANY domain
 * - Bare archive pages (/recipes, /blog with no slug)
 *
 * Accepts:
 * - Any specific slug on an allowed domain
 * - Non-allowed domains only if they contain a RECIPE_URL_INDICATOR
 */
export function isValidRecipeUrl(url: string): boolean {
  let hostname: string;
  let pathname: string;

  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.toLowerCase().replace('www.', '');
    pathname = parsed.pathname.toLowerCase();
  } catch {
    return false;
  }

  // Reject blocked domains unconditionally
  if (BLOCKED_DOMAINS.has(hostname)) return false;

  // Reject known non-recipe URL path patterns (author, tag, category, etc.)
  if (NON_RECIPE_URL_PATTERNS.some((p) => pathname.includes(p))) return false;

  // Reject structural/promo paths on any domain — these are never single recipes
  if (hasNonRecipePathSegment(pathname)) return false;
  if (NON_RECIPE_PATH_SUBSTRINGS.some((p) => pathname.includes(p))) return false;

  // Reject bare /recipes or /blog archive pages (no specific slug)
  if (isBareArchivePage(pathname)) return false;

  // Accept if from an allowed domain (trusted source)
  if (ALLOWED_DOMAINS.has(hostname)) {
    const skipPaths = ['/about', '/contact', '/privacy', '/terms', '/shop'];
    return !skipPaths.some((p) => pathname.startsWith(p));
  }

  // For other domains, require a recipe indicator in the URL
  return RECIPE_URL_INDICATORS.some((indicator) => pathname.includes(indicator));
}

/**
 * Check if any path segment matches a non-recipe segment.
 */
function hasNonRecipePathSegment(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments.some((seg) => NON_RECIPE_PATH_SEGMENTS.includes(seg));
}

/**
 * Detect bare archive pages with no specific recipe slug.
 * Does NOT reject paths like /recipes/my-great-dish or /blog/2021/01/soup.
 */
function isBareArchivePage(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '');
  // Empty path (homepage) is never a recipe
  if (normalized === '' || normalized === '/') return true;
  const bareArchivePaths = ['/recipes', '/blog', '/recipe', '/cooking'];
  return bareArchivePaths.includes(normalized);
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}
