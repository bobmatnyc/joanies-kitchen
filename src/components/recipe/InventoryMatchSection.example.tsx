/**
 * InventoryMatchSection - Usage Examples
 *
 * This file demonstrates how to integrate the InventoryMatchSection component
 * into recipe pages and other contexts.
 */

import { InventoryMatchSection } from './InventoryMatchSection';

/**
 * Example 1: Basic Usage in a Recipe Detail Page
 *
 * The simplest usage - just pass recipe ID and ingredients array
 */
export function RecipeDetailPageExample({ recipe }: { recipe: any }) {
  // Parse ingredients if stored as JSON string
  const ingredients =
    typeof recipe.ingredients === 'string'
      ? JSON.parse(recipe.ingredients)
      : recipe.ingredients || [];

  return (
    <div className="space-y-6">
      {/* Recipe header, images, etc. */}
      <h1>{recipe.name}</h1>

      {/* Inventory Match Section */}
      <InventoryMatchSection recipeId={recipe.id} ingredients={ingredients} />

      {/* Rest of recipe content: instructions, etc. */}
    </div>
  );
}

/**
 * Example 2: With Custom Styling
 *
 * Add custom classes to match your page design
 */
export function StyledExample({ recipe }: { recipe: any }) {
  const ingredients = JSON.parse(recipe.ingredients);

  return (
    <InventoryMatchSection
      recipeId={recipe.id}
      ingredients={ingredients}
      className="my-8 shadow-lg"
    />
  );
}

/**
 * Example 3: In a Recipe Card/Preview Context
 *
 * Can be used in recipe cards to show quick match info
 */
export function RecipeCardWithMatchExample({ recipe }: { recipe: any }) {
  const ingredients = JSON.parse(recipe.ingredients);

  return (
    <div className="recipe-card border rounded-lg p-4 space-y-4">
      <h3 className="font-bold">{recipe.name}</h3>
      <img src={recipe.image_url} alt={recipe.name} />

      {/* Compact version for cards */}
      <InventoryMatchSection recipeId={recipe.id} ingredients={ingredients} className="text-sm" />

      <button>View Recipe</button>
    </div>
  );
}

/**
 * Example 4: Integration with Recipe Page Action
 *
 * Full example showing how to use in a Next.js recipe page
 */
export async function RecipePageFullExample({ slug }: { slug: string }) {
  // Fetch recipe (server action or API call)
  // const recipe = await getRecipeBySlug(slug);

  const recipe = {
    id: '123',
    name: 'Spaghetti Carbonara',
    ingredients: JSON.stringify([
      '400g spaghetti',
      '200g pancetta or guanciale',
      '4 large eggs',
      '100g Pecorino Romano cheese',
      'Black pepper',
      'Salt',
    ]),
  };

  const ingredients = JSON.parse(recipe.ingredients);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Recipe Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{recipe.name}</h1>
      </header>

      {/* Inventory Match - Prominent placement near top */}
      <section className="mb-8">
        <InventoryMatchSection recipeId={recipe.id} ingredients={ingredients} />
      </section>

      {/* Ingredients List */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Ingredients</h2>
        <ul className="space-y-2">
          {ingredients.map((ingredient: string, idx: number) => (
            <li key={idx}>{ingredient}</li>
          ))}
        </ul>
      </section>

      {/* Instructions, etc. */}
    </div>
  );
}

/**
 * Example 5: Conditional Rendering
 *
 * Only show inventory match for certain recipe types or contexts
 */
export function ConditionalExample({ recipe }: { recipe: any }) {
  const ingredients = JSON.parse(recipe.ingredients);

  // Only show for recipes with more than 3 ingredients
  const shouldShowMatch = ingredients.length > 3;

  if (!shouldShowMatch) {
    return null;
  }

  return <InventoryMatchSection recipeId={recipe.id} ingredients={ingredients} />;
}

/**
 * Props Reference:
 *
 * interface InventoryMatchSectionProps {
 *   recipeId: string;          // Required: Recipe ID (for sign-in redirect)
 *   ingredients: string[];     // Required: Array of ingredient strings
 *   className?: string;        // Optional: Additional CSS classes
 * }
 *
 * Features:
 * - Automatic authentication detection (shows sign-in CTA if not logged in)
 * - Empty inventory detection (shows "add ingredients" CTA)
 * - Intelligent ingredient matching (fuzzy matching with common variations)
 * - Match percentage calculation
 * - Color-coded sections (green = have, orange = need)
 * - Mobile responsive design
 * - Loading and error states
 * - Direct links to /fridge page for inventory management
 *
 * States:
 * 1. Loading: Shows spinner
 * 2. Not Signed In: Shows sign-in CTA
 * 3. Empty Inventory: Shows "add ingredients" CTA
 * 4. Has Matches: Shows full ingredient match breakdown
 * 5. Error: Shows error message
 */
