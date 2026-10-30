/**
 * #185: one image picker for every ingestion and crawl path. Ingestion stored the
 * source site's logo as the recipe image while the page's og:image held the dish photo.
 */
import { isLikelySiteAsset, toUsableImageUrl } from '@/lib/utils/recipe-image';

/** Image candidates found on a scraped recipe page, by where they came from. */
export interface RecipeImageSources {
  /** The page's `og:image` (string or list). */
  ogImage?: unknown;
  /** JSON-LD `Recipe.image`: a URL, an ImageObject, or a list of either. */
  jsonLdImage?: unknown;
  /** The page's `twitter:image`. */
  twitterImage?: unknown;
  /** Images in the page body, or the one an LLM chose from it. */
  contentImages?: unknown;
}

/** Flattens a string, ImageObject (`url`/`contentUrl`/`src`) or nested list into entries. */
function flattenCandidates(value: unknown): unknown[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(flattenCandidates);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return flattenCandidates(obj.url ?? obj.contentUrl ?? obj.src);
  }
  return [value];
}

/**
 * Why: a stored image must be an absolute remote photo; a relative path would resolve
 * against this app's domain, and a logo or icon is not a dish photo (#185).
 * What: the usable absolute http(s) URL, or null when the value is not one or
 * `isLikelySiteAsset` flags it.
 * Test: `recipe-image-185.test.ts` "pickRecipeImage".
 */
export function toIngestibleImageUrl(value: unknown): string | null {
  const url = toUsableImageUrl(value);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return isLikelySiteAsset(url) ? null : url;
}

/** #185: a relative candidate (`/wp-content/uploads/x.jpg`) resolved against the page URL. */
function resolveCandidate(candidate: unknown, baseUrl: string | null | undefined): unknown {
  if (typeof candidate !== 'string' || !baseUrl) return candidate;
  try {
    return new URL(candidate.trim(), baseUrl).href;
  } catch {
    return candidate;
  }
}

/**
 * Why: the page's own photo is nearly always its og:image (#185).
 * What: up to `max` distinct ingestible URLs, taken in the order og:image, JSON-LD
 * `Recipe.image`, twitter:image, in-content images. A relative candidate is resolved
 * against `baseUrl` (the page URL) first; without one it is dropped. Empty when no
 * candidate passes.
 * Test: `recipe-image-185.test.ts` "pickRecipeImage".
 */
export function pickRecipeImages(
  sources: RecipeImageSources,
  baseUrl: string | null | undefined,
  max = 1
): string[] {
  const ordered = [
    sources.ogImage,
    sources.jsonLdImage,
    sources.twitterImage,
    sources.contentImages,
  ].flatMap(flattenCandidates);
  const picked: string[] = [];
  for (const candidate of ordered) {
    if (picked.length >= max) break;
    const url = toIngestibleImageUrl(resolveCandidate(candidate, baseUrl));
    if (url && !picked.includes(url)) picked.push(url);
  }
  return picked;
}

/** First image `pickRecipeImages` accepts, or null: never a site asset (#185). */
export function pickRecipeImage(
  sources: RecipeImageSources,
  baseUrl: string | null | undefined
): string | null {
  return pickRecipeImages(sources, baseUrl, 1)[0] ?? null;
}

/** og:image and twitter:image from a Firecrawl `metadata` object, under either key style. */
export function metadataImageSources(
  metadata: unknown
): Pick<RecipeImageSources, 'ogImage' | 'twitterImage'> {
  if (!metadata || typeof metadata !== 'object') return {};
  const m = metadata as Record<string, unknown>;
  return {
    ogImage: [m.ogImage, m['og:image']],
    twitterImage: [m.twitterImage, m['twitter:image']],
  };
}
