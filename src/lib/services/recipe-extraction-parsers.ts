/**
 * Recipe extraction parsers (#298: moved from recipe-extraction.service.ts).
 *
 * Pure mapping of schema.org Recipe data and regex parsing of page markdown into
 * a ScrapedRecipe. RecipeExtractionService delegates to these.
 */

import { metadataImageSources, pickRecipeImage } from '@/lib/utils/recipe-image-picker';
import { toRecipeInt } from '@/lib/utils/recipe-int';
import type { FirecrawlRecipeSchema, ScrapedRecipe } from './recipe-extraction.types';

/**
 * Map Firecrawl schema.org Recipe data to ScrapedRecipe
 */
export function mapFirecrawlSchema(
  data: FirecrawlRecipeSchema,
  url: string,
  metadata?: Record<string, unknown>
): ScrapedRecipe {
  const title = data.name || data.title || 'Untitled Recipe';

  const ingredients = extractIngredients(data);
  const instructions = extractInstructions(data);

  const servingsRaw = data.recipeYield ?? data.servings;
  // #12: same shared coercion as the LLM path.
  const servings = toRecipeInt(servingsRaw) ?? undefined;

  const tags: string[] = [];
  if (data.recipeCuisine) tags.push(data.recipeCuisine);
  if (data.recipeCategory) tags.push(data.recipeCategory);
  if (data.keywords) {
    const kws =
      typeof data.keywords === 'string'
        ? data.keywords.split(',').map((k) => k.trim())
        : data.keywords;
    tags.push(...kws.filter(Boolean));
  }

  // #185: og:image, then JSON-LD Recipe.image, then twitter:image; never a site asset.
  const imageUrl =
    pickRecipeImage({ ...metadataImageSources(metadata), jsonLdImage: data.image }, url) ??
    undefined;

  const chefName =
    typeof data.author === 'string' ? data.author : (data.author as { name?: string })?.name;

  return {
    url,
    title,
    description: data.description,
    ingredients,
    instructions,
    prep_time: parseISO8601Duration(data.prepTime),
    cook_time: parseISO8601Duration(data.cookTime),
    servings,
    cuisine: data.recipeCuisine,
    tags: [...new Set(tags)],
    image_url: imageUrl,
    chef_name: chefName,
    extraction_method: 'firecrawl',
  };
}

/**
 * Parse markdown content into a ScrapedRecipe using regex
 */
export function parseMarkdown(
  markdown: string,
  metadata: Record<string, string> | undefined,
  url: string
): ScrapedRecipe | null {
  const title = metadata?.ogTitle || metadata?.title || extractFirstHeading(markdown);

  if (!title) return null;

  const ingredients = extractIngredientsFromMarkdown(markdown);
  const instructions = extractInstructionsFromMarkdown(markdown);
  const times = extractTimesFromMarkdown(markdown);
  const servings = extractServingsFromMarkdown(markdown);
  const chefName = extractAuthorFromMarkdown(markdown, metadata);
  // #185: og:image, then twitter:image, then body images; a header logo is skipped.
  const imageUrl =
    pickRecipeImage(
      {
        ...metadataImageSources(metadata),
        contentImages: extractImagesFromMarkdown(markdown),
      },
      url
    ) ?? undefined;

  return {
    url,
    title,
    description: metadata?.ogDescription ?? metadata?.description,
    ingredients,
    instructions,
    prep_time: times.prepTime,
    cook_time: times.cookTime,
    servings,
    tags: [],
    image_url: imageUrl,
    chef_name: chefName,
    extraction_method: 'firecrawl', // overwritten by caller
  };
}

// ---------------------------------------------------------------------------
// Markdown parsing helpers
// ---------------------------------------------------------------------------

function extractFirstHeading(markdown: string): string | undefined {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

function extractIngredientsFromMarkdown(markdown: string): string[] {
  const match = markdown.match(/#+\s*Ingredients?\s*\n([\s\S]*?)(?=\n#+\s|\n\n---|\n\n\*\*|$)/i);
  if (!match) return [];

  return match[1]
    .split('\n')
    .map((line) => {
      const listMatch = line.trim().match(/^(?:[*-]|\d+\.)\s+(.+)$/);
      return listMatch ? listMatch[1].trim() : '';
    })
    .filter((s) => s.length > 2);
}

function extractInstructionsFromMarkdown(markdown: string): string[] {
  const match = markdown.match(
    /#+\s*(?:Instructions?|Directions?|Method|Steps?|Preparation)\s*\n([\s\S]*?)(?=\n#+\s|\n\n---|\n\n\*\*|$)/i
  );
  if (!match) return [];

  const lines: string[] = [];
  for (const line of match[1].split('\n')) {
    const cleaned = line.trim();
    const listMatch = cleaned.match(/^(?:[*-]|\d+\.)\s+(.+)$/);
    if (listMatch && listMatch[1].length > 10) {
      lines.push(listMatch[1].trim());
    } else if (cleaned.length > 20 && !cleaned.startsWith('#')) {
      lines.push(cleaned);
    }
  }
  return lines;
}

function extractTimesFromMarkdown(markdown: string): { prepTime?: number; cookTime?: number } {
  const times: { prepTime?: number; cookTime?: number } = {};

  const prepMatch = markdown.match(/Prep(?:\s+Time)?:\s*(?:(\d+)\s*h(?:ours?)?\s*)?(\d+)\s*min/i);
  if (prepMatch) {
    const hours = prepMatch[1] ? parseInt(prepMatch[1]) : 0;
    times.prepTime = hours * 60 + parseInt(prepMatch[2]);
  }

  const cookMatch = markdown.match(/Cook(?:\s+Time)?:\s*(?:(\d+)\s*h(?:ours?)?\s*)?(\d+)\s*min/i);
  if (cookMatch) {
    const hours = cookMatch[1] ? parseInt(cookMatch[1]) : 0;
    times.cookTime = hours * 60 + parseInt(cookMatch[2]);
  }

  return times;
}

function extractServingsFromMarkdown(markdown: string): number | undefined {
  const match = markdown.match(/(?:Servings?|Yields?|Makes):\s*(\d+)/i);
  return match ? parseInt(match[1]) : undefined;
}

function extractAuthorFromMarkdown(
  markdown: string,
  metadata?: Record<string, string>
): string | undefined {
  if (metadata?.author) return metadata.author;

  // Look for "By [Author Name]" patterns
  const bylineMatch = markdown.match(/^by\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/m);
  if (bylineMatch) return bylineMatch[1];

  // Look for "Recipe by [Name]" or "Author: [Name]"
  const authorMatch = markdown.match(
    /(?:Recipe by|Author:|Written by)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i
  );
  return authorMatch ? authorMatch[1] : undefined;
}

// #185: every body image in order, so the picker can skip a logo that comes first.
// Relative paths are kept; the picker resolves them against the page URL.
function extractImagesFromMarkdown(markdown: string): string[] {
  return [...markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]);
}

// ---------------------------------------------------------------------------
// Schema.org data helpers
// ---------------------------------------------------------------------------

function extractIngredients(data: FirecrawlRecipeSchema): string[] {
  if (data.recipeIngredient?.length) return data.recipeIngredient.filter(Boolean);
  if (data.ingredients?.length) return data.ingredients.filter(Boolean);
  return [];
}

function extractInstructions(data: FirecrawlRecipeSchema): string[] {
  if (data.recipeInstructions) {
    if (Array.isArray(data.recipeInstructions)) {
      return data.recipeInstructions
        .map((step) => {
          if (typeof step === 'string') return step;
          return step.text ?? step.name ?? '';
        })
        .filter(Boolean);
    }
    if (typeof data.recipeInstructions === 'string') {
      return [data.recipeInstructions];
    }
  }
  if (data.instructions?.length) return data.instructions.filter(Boolean);
  return [];
}

/**
 * Parse ISO 8601 duration string (PT30M, PT1H15M) to minutes
 */
function parseISO8601Duration(duration?: string): number | undefined {
  if (!duration) return undefined;

  const isoMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (isoMatch) {
    const hours = isoMatch[1] ? parseInt(isoMatch[1]) : 0;
    const minutes = isoMatch[2] ? parseInt(isoMatch[2]) : 0;
    return hours * 60 + minutes || undefined;
  }

  const numMatch = duration.match(/^(\d+)$/);
  return numMatch ? parseInt(numMatch[1]) : undefined;
}
