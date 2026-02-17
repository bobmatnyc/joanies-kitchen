/**
 * Frontend-ready types with correct TypeScript types
 *
 * Use these types instead of raw Drizzle inferred types in:
 * - React components
 * - API responses
 * - Client-side utilities
 *
 * These types have been transformed from database types:
 * - NUMERIC/DECIMAL (string) → number
 * - JSON text (string) → parsed objects/arrays
 * - JSONB (any) → typed objects
 *
 * For database operations, use the raw types from schema files.
 * For frontend operations, use these parsed types.
 */

// Re-export all parsed types
export type {
  ParsedRecipe,
  ParsedIngredientEntry,
  ParsedNutrition,
  ParsedMeal,
  ParsedChef,
  ParsedIngredient,
  ParsedTool,
  ParsedInventoryItem,
} from './transformers';

// Re-export transformers
export {
  parseRecipe,
  parseRecipes,
  parseMeal,
  parseMeals,
  parseChef,
  parseChefs,
  parseIngredient,
  parseIngredients,
  parseTool,
  parseTools,
  parseInventoryItem,
  parseInventoryItems,
  parseDecimal,
  parseInteger,
  parseJsonField,
  parseJsonArray,
} from './transformers';

/**
 * Type guard to check if a recipe has been parsed
 *
 * @param recipe - Recipe object to check
 * @returns True if recipe has parsed types
 */
export function isParsedRecipe(recipe: unknown): recipe is import('./transformers').ParsedRecipe {
  if (!recipe || typeof recipe !== 'object') return false;
  const r = recipe as any;

  // Check if numeric fields are numbers (parsed) vs strings (raw)
  return (
    (r.confidence_score === null || typeof r.confidence_score === 'number') &&
    (r.system_rating === null || typeof r.system_rating === 'number') &&
    Array.isArray(r.images)
  );
}

/**
 * Type guard to check if a meal has been parsed
 *
 * @param meal - Meal object to check
 * @returns True if meal has parsed types
 */
export function isParsedMeal(meal: unknown): meal is import('./transformers').ParsedMeal {
  if (!meal || typeof meal !== 'object') return false;
  const m = meal as any;

  return (
    (m.estimated_total_cost === null || typeof m.estimated_total_cost === 'number') &&
    Array.isArray(m.tags)
  );
}

/**
 * Type guard to check if a chef has been parsed
 *
 * @param chef - Chef object to check
 * @returns True if chef has parsed types
 */
export function isParsedChef(chef: unknown): chef is import('./transformers').ParsedChef {
  if (!chef || typeof chef !== 'object') return false;
  const c = chef as any;

  return (
    (c.latitude === null || typeof c.latitude === 'number') &&
    (c.longitude === null || typeof c.longitude === 'number')
  );
}

/**
 * Type guard to check if an ingredient has been parsed
 *
 * @param ingredient - Ingredient object to check
 * @returns True if ingredient has parsed types
 */
export function isParsedIngredient(ingredient: unknown): ingredient is import('./transformers').ParsedIngredient {
  if (!ingredient || typeof ingredient !== 'object') return false;
  const i = ingredient as any;

  return Array.isArray(i.aliases);
}

/**
 * Usage Examples:
 *
 * ```typescript
 * // In API routes (backend):
 * import { parseRecipe, parseRecipes } from '@/lib/db/transformed-types';
 * import { db } from '@/lib/db';
 * import { recipes } from '@/lib/db/schema';
 *
 * // Single recipe
 * const rawRecipe = await db.query.recipes.findFirst({ where: eq(recipes.id, id) });
 * const recipe = parseRecipe(rawRecipe);
 * // recipe.images is now string[] instead of string
 * // recipe.confidence_score is now number | null instead of string | null
 *
 * // Multiple recipes
 * const rawRecipes = await db.query.recipes.findMany();
 * const recipes = parseRecipes(rawRecipes);
 * ```
 *
 * ```typescript
 * // In React components (frontend):
 * import type { ParsedRecipe } from '@/lib/db/transformed-types';
 *
 * interface RecipeCardProps {
 *   recipe: ParsedRecipe; // Use ParsedRecipe, not Recipe
 * }
 *
 * function RecipeCard({ recipe }: RecipeCardProps) {
 *   // recipe.images is string[], can map directly
 *   return (
 *     <div>
 *       {recipe.images.map(img => <img src={img} />)}
 *       <p>Rating: {recipe.system_rating?.toFixed(1)}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * ```typescript
 * // In service layer:
 * import { parseRecipe, type ParsedRecipe } from '@/lib/db/transformed-types';
 *
 * export class RecipeService {
 *   async findById(id: string): Promise<ParsedRecipe | null> {
 *     const rawRecipe = await db.query.recipes.findFirst({ where: eq(recipes.id, id) });
 *     return rawRecipe ? parseRecipe(rawRecipe) : null;
 *   }
 * }
 * ```
 */
