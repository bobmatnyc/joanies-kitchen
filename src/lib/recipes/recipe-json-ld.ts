import type { ResolvedRecipeSource } from './recipe-source';
import { resolvedExternalUrl } from './recipe-source';

/**
 * Tdb: show recipe source (Bob 2026-11-09)
 *
 * Why: the schema.org Recipe credited every system recipe to "Joanie's Kitchen" and never
 * named the chef or site it came from.
 * What: builds the recipe page's JSON-LD (moved out of RecipePageClient). Author: the chef
 * (Person, chef page url) when known; else the source site (Organization); else the
 * existing public-profile Person or the "Joanie's Kitchen" Organization. `publisher` is
 * always "Joanie's Kitchen"; `isBasedOn` is the resolved http(s) source URL. It reads only
 * `display_name` from the profile, so no email can reach the output.
 * Test: src/app/recipes/[slug]/__tests__/recipe-json-ld.test.ts
 */

const SITE_NAME = "Joanie's Kitchen";

/** The parsed recipe fields the JSON-LD reads (see parseRecipe). */
export interface JsonLdRecipe {
  id: string;
  slug?: string | null;
  name: string;
  description?: string | null;
  images?: string[] | null;
  image_url?: string | null;
  created_at?: unknown;
  updated_at?: unknown;
  prep_time?: number | null;
  cook_time?: number | null;
  servings?: number | null;
  cuisine?: string | null;
  tags?: string[] | null;
  ingredients?: string[] | null;
  instructions?: string[] | null;
  nutrition_info?: unknown;
  avg_user_rating?: unknown;
  total_user_ratings?: number | null;
  license?: string | null;
}

export interface RecipeJsonLdInput {
  recipe: JsonLdRecipe;
  baseUrl: string;
  totalTime: number;
  /** Public profile from getProfileByUserId; only `display_name` is read. */
  authorProfile: { display_name?: string | null } | null;
  source: ResolvedRecipeSource | null;
}

function buildAuthor(input: RecipeJsonLdInput): Record<string, string> {
  const { source, baseUrl, authorProfile } = input;
  if (source?.kind === 'chef' && source.href) {
    return { '@type': 'Person', name: source.label, url: `${baseUrl}${source.href}` };
  }
  if ((source?.kind === 'site' || source?.kind === 'themealdb') && source.href) {
    return { '@type': 'Organization', name: source.label, url: new URL(source.href).origin };
  }
  // Existing behaviour: the owner's public profile, else the site.
  return authorProfile?.display_name
    ? { '@type': 'Person', name: authorProfile.display_name }
    : { '@type': 'Organization', name: SITE_NAME };
}

export function buildRecipeJsonLd(input: RecipeJsonLdInput): Record<string, unknown> {
  const { recipe, baseUrl, totalTime } = input;
  const recipeUrl = `${baseUrl}/recipes/${recipe.slug || recipe.id}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name,
    description: recipe.description || `Delicious ${recipe.name} recipe from Joanie's Kitchen`,
    image: recipe.images?.[0] || (recipe.image_url ? [recipe.image_url] : []),
    author: buildAuthor(input),
    publisher: { '@type': 'Organization', name: SITE_NAME, url: baseUrl },
    isBasedOn: resolvedExternalUrl(input.source),
    datePublished: recipe.created_at,
    dateModified: recipe.updated_at,
    prepTime: recipe.prep_time ? `PT${recipe.prep_time}M` : undefined,
    cookTime: recipe.cook_time ? `PT${recipe.cook_time}M` : undefined,
    totalTime: totalTime > 0 ? `PT${totalTime}M` : undefined,
    recipeYield: recipe.servings ? `${recipe.servings} servings` : undefined,
    recipeCategory: recipe.cuisine || undefined,
    recipeCuisine: recipe.cuisine || undefined,
    keywords: recipe.tags?.join(', ') || undefined,
    recipeIngredient: recipe.ingredients || [],
    recipeInstructions:
      recipe.instructions?.map((step, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        text: step,
      })) || [],
    nutrition: recipe.nutrition_info
      ? {
          '@type': 'NutritionInformation',
          ...(typeof recipe.nutrition_info === 'string'
            ? JSON.parse(recipe.nutrition_info)
            : (recipe.nutrition_info as object)),
        }
      : undefined,
    aggregateRating:
      recipe.avg_user_rating && recipe.total_user_ratings
        ? {
            '@type': 'AggregateRating',
            ratingValue: recipe.avg_user_rating,
            ratingCount: recipe.total_user_ratings,
          }
        : undefined,
    url: recipeUrl,
    isAccessibleForFree: 'True',
    // License URL bug left as-is (out of scope for Tdb).
    license: recipe.license
      ? `https://creativecommons.org/licenses/${recipe.license.toLowerCase().replace(/_/g, '-')}/4.0/`
      : undefined,
  };
}
