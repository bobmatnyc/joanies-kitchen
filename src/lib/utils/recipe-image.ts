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

/**
 * Why: `<Image>` throws or renders nothing for a value that is not an absolute
 * http(s) URL or a root-relative path.
 * What: returns the trimmed URL when usable (protocol-relative `//host` is
 * upgraded to https), else null.
 * Test: `recipe-image.test.ts` "toUsableImageUrl".
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
  if (url.startsWith('//')) return url.length > 2 ? `https:${url}` : null;
  if (url.startsWith('/')) return url.length > 1 ? url : null;
  if (/^https?:\/\/[^/\s]+/i.test(url)) return url;
  return null;
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
