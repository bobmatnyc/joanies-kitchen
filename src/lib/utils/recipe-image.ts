/**
 * #94: one resolver for a recipe's display image, shared by every recipe card.
 * Scraped-article recipes store `images` in shapes the old per-component
 * `getHeroImage` copies passed straight to `<Image>` (objects, "", relative
 * paths), which rendered nothing on the home page.
 */
import { getPlaceholderImage } from '@/lib/utils/recipe-placeholders';

/** Fields the resolver reads; satisfied by `Recipe` and the recipe-of-the-day payload. */
export interface RecipeImageSource {
  images?: unknown;
  image_url?: unknown;
  tags?: unknown;
}

// #185: path patterns of a source site's own assets (logos, icons, theme files). Each
// keyword must start a word, so `catalogo-pasta.jpg` and `iconic-burger.jpg` stay photos.
const SITE_ASSET_PATH_PATTERNS: readonly RegExp[] = [
  /\.svgz?$/i, // vector art, never a dish photo
  /\/themes\//i, // CMS theme assets, including wp-content/themes
  /favicon/i,
  /(?:^|[^a-z])logo/i, // logo.svg, omv-logo-200x70, LogoTM
  /[a-z0-9]Logo/, // camelCase SiteLogo.png
  /(?:^|[^a-z])icons?(?:[^a-z]|$)/i, // /icons/, apple-touch-icon.png; not "iconic"
  /(?:^|[^a-z])signature/i,
  /(?:^|[^a-z])sprite/i,
  /(?:^|[^a-z])placeholder/i,
  /(?:^|[^a-z])pixel(?:[^a-z]|$)/i, // tracking pixel
];

/** URL path, percent-decoded where possible; null when the value does not parse. */
function imagePathOf(url: string): string | null {
  let path: string;
  try {
    path = new URL(url, 'https://local.invalid').pathname;
  } catch {
    return null;
  }
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * Why: ingestion stored source-site logos (`wp-content/themes/.../logo.svg`) as recipe
 * photos, and a logo is a valid URL, so the #172 checks kept it (#185).
 * What: true for a `data:` URI, or when the URL path matches a site-asset pattern:
 * ends in `.svg`, contains `/themes/` or `favicon`, or has a word starting with `logo`,
 * `signature`, `sprite` or `placeholder`, or the whole word `icon(s)` or `pixel`, or a
 * `1x1` file name. Only the path is read, never the host or query. Callers apply it to
 * remote URLs only: local paths such as `/placeholders/generic.svg` are this app's own.
 * Test: `recipe-image-185.test.ts` "isLikelySiteAsset".
 */
export function isLikelySiteAsset(value: string): boolean {
  const raw = value.trim();
  if (/^data:/i.test(raw)) return true;
  const path = imagePathOf(raw);
  if (path === null) return false;
  if (SITE_ASSET_PATH_PATTERNS.some((re) => re.test(path))) return true;
  // #185: a 1x1 tracking gif; checked on the file name only, not on directory names.
  const file = path.slice(path.lastIndexOf('/') + 1);
  return /(?:^|[^a-z0-9])1x1(?:[^a-z0-9]|$)/i.test(file);
}

/**
 * Why: `<Image>` throws or renders nothing for a value that is not an absolute
 * http(s) URL or a root-relative path.
 * What: returns the trimmed URL when usable (protocol-relative `//host` is
 * upgraded to https), else null. A remote URL that `isLikelySiteAsset` flags
 * is not usable (#185); root-relative paths are this app's own files and pass.
 * Test: `recipe-image.test.ts` "toUsableImageUrl", `recipe-image-185.test.ts`.
 */
export function toUsableImageUrl(value: unknown): string | null {
  let candidate = value;
  // #94: scraped entries may be objects such as { url } or { src }.
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const obj = candidate as Record<string, unknown>;
    candidate = obj.url ?? obj.src;
  }
  if (typeof candidate !== 'string') return null;
  const url = candidate.trim();
  if (url.startsWith('//')) return url.length > 2 ? unlessSiteAsset(`https:${url}`) : null;
  if (url.startsWith('/')) return url.length > 1 ? url : null;
  if (/^https?:\/\/[^/\s]+/i.test(url)) return unlessSiteAsset(url);
  return null;
}

/** #185: a stored remote logo or icon is hidden on read, so the render path shows the placeholder. */
function unlessSiteAsset(url: string): string | null {
  return isLikelySiteAsset(url) ? null : url;
}

/**
 * #172: ONE rule for "can this string be an image src". Drops every `data:` URI
 * (not only svg lazy-load placeholders): the app stores remote or Blob URLs, so an
 * inline payload is never a real recipe photo and a bloated `data:` string in a
 * row is a scraper artefact. Also drops bare words (`1`, `fill`) and blanks.
 */
export function isUsableImageUrl(value: unknown): boolean {
  return toUsableImageUrl(value) !== null;
}

/**
 * #172: parses a Postgres array literal such as `{"/a.png","/b.png"}` or `{a,b}`.
 * Handles double-quoted elements with backslash escapes; unquoted NULL is skipped.
 * Returns null when `text` is not wrapped in braces.
 */
export function parsePostgresArrayLiteral(text: string): string[] | null {
  const s = text.trim();
  if (s.length < 2 || !s.startsWith('{') || !s.endsWith('}')) return null;
  const body = s.slice(1, -1);
  const out: string[] = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    if (i >= body.length) break;
    if (body[i] === '"') {
      i++;
      let el = '';
      while (i < body.length && body[i] !== '"') {
        if (body[i] === '\\' && i + 1 < body.length) i++;
        el += body[i];
        i++;
      }
      i++; // closing quote
      out.push(el);
    } else {
      let el = '';
      while (i < body.length && body[i] !== ',') {
        el += body[i];
        i++;
      }
      el = el.trim();
      if (el.toUpperCase() !== 'NULL') out.push(el);
    }
    while (i < body.length && body[i] !== ',') i++;
    i++; // comma
  }
  return out;
}

/** Parses `images` (JSON string or array) into a list; never throws. */
export function parseRecipeImages(images: unknown): unknown[] {
  if (Array.isArray(images)) return images;
  if (typeof images !== 'string' || images.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(images);
    if (Array.isArray(parsed)) return parsed;
    // #94: a bare JSON string or object is treated as a single entry.
    return parsed == null ? [] : [parsed];
  } catch {
    // #172: JSON failed first so a JSON object string is not misread; some rows
    // hold a Postgres array literal `{"/x.png"}` instead of JSON.
    const pgArray = parsePostgresArrayLiteral(images);
    if (pgArray) return pgArray;
    // #94: a non-JSON string may itself be a URL.
    return [images];
  }
}

/** Usable image URLs from `images`, in stored order. */
export function getRecipeImageUrls(images: unknown): string[] {
  return parseRecipeImages(images)
    .map(toUsableImageUrl)
    .filter((u): u is string => u !== null);
}

/**
 * #179: re-serializes `images` for an API payload that keeps the stored string shape.
 * Returns a JSON array string of usable URLs only, or null when none remain.
 */
export function serializeUsableImages(images: unknown): string | null {
  const urls = getRecipeImageUrls(images);
  return urls.length > 0 ? JSON.stringify(urls) : null;
}

/** Parses `tags` into strings; never throws. */
export function parseRecipeTags(tags: unknown): string[] {
  const list = Array.isArray(tags) ? tags : parseRecipeImages(tags);
  return list.filter((t): t is string => typeof t === 'string');
}

/**
 * Why: a root-relative `images` entry may point at a missing local file, so it
 * must not outrank a remote `image_url` (#94, same ranking as the old RecipeCard).
 * What: usable URLs in display order, deduplicated: http(s) entries from
 * `images`, then `image_url`, then root-relative entries from `images`.
 * Test: `recipe-image.test.ts` "getRecipeImageCandidates".
 */
export function getRecipeImageCandidates(recipe: RecipeImageSource): string[] {
  const urls = getRecipeImageUrls(recipe.images);
  const remote = urls.filter((u) => !u.startsWith('/'));
  const local = urls.filter((u) => u.startsWith('/'));
  const fallback = toUsableImageUrl(recipe.image_url);
  const ordered = [...remote, ...(fallback ? [fallback] : []), ...local];
  return [...new Set(ordered)];
}

/**
 * Why: the home carousel, recipe of the day and RecipeCard must agree on which
 * image a recipe shows (#94).
 * What: first entry of `getRecipeImageCandidates`, else the tag-themed
 * placeholder. Never throws.
 * Test: `recipe-image.test.ts` "resolveRecipeImage".
 */
export function resolveRecipeImage(recipe: RecipeImageSource): string {
  return getRecipeImageCandidates(recipe)[0] ?? getPlaceholderImage(parseRecipeTags(recipe.tags));
}

/**
 * Why: the recipe page hero rendered nothing when a recipe had no usable image (#185).
 * What: usable `images` in stored order; else `image_url`; else the same tag-themed
 * placeholder `resolveRecipeImage` uses. Never empty.
 * Test: `recipe-image-185.test.ts` "getRecipeHeroImages", `RecipePageHero185.test.tsx`.
 */
export function getRecipeHeroImages(recipe: RecipeImageSource): string[] {
  const urls = getRecipeImageUrls(recipe.images);
  if (urls.length > 0) return urls;
  const single = toUsableImageUrl(recipe.image_url);
  return [single ?? getPlaceholderImage(parseRecipeTags(recipe.tags))];
}
