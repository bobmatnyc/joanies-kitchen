'use client';

/**
 * SubstitutionSuggestionsWrapper
 *
 * Wrapper component that:
 * 1. Fetches user's inventory
 * 2. Matches against recipe ingredients
 * 3. Determines missing ingredients
 * 4. Passes to SubstitutionSuggestions component
 *
 * This keeps the SubstitutionSuggestions component pure and testable.
 */

import { useSessionUser } from '@/lib/use-session-user';
import { useEffect, useState } from 'react';
import { getUserInventory } from '@/app/actions/inventory';
import { SubstitutionSuggestions } from './SubstitutionSuggestions';

interface SubstitutionSuggestionsWrapperProps {
  recipeId: string;
  recipeName: string;
  ingredients: string[];
  className?: string;
}

/**
 * Parse ingredient name from full ingredient string
 * (Same logic as InventoryMatchSection for consistency)
 */
function parseIngredientName(ingredient: string): string {
  let parsed = ingredient.toLowerCase().trim();

  // Remove common units
  const units = [
    'cup',
    'cups',
    'tablespoon',
    'tablespoons',
    'tbsp',
    'teaspoon',
    'teaspoons',
    'tsp',
    'ounce',
    'ounces',
    'oz',
    'pound',
    'pounds',
    'lb',
    'lbs',
    'gram',
    'grams',
    'g',
    'kilogram',
    'kilograms',
    'kg',
    'milliliter',
    'milliliters',
    'ml',
    'liter',
    'liters',
    'l',
    'pinch',
    'dash',
    'handful',
    'clove',
    'cloves',
    'can',
    'cans',
    'package',
    'packages',
    'piece',
    'pieces',
    'slice',
    'slices',
    'sprig',
    'sprigs',
    'stalk',
    'stalks',
  ];

  const unitPattern = new RegExp(`\\b(${units.join('|')})\\b`, 'gi');
  parsed = parsed.replace(unitPattern, '');

  // Remove numbers and fractions
  parsed = parsed.replace(/\b\d+\/\d+|\b\d+\.?\d*\b/g, '');

  // Remove common descriptors
  const descriptors = [
    'fresh',
    'dried',
    'frozen',
    'canned',
    'organic',
    'chopped',
    'diced',
    'sliced',
    'minced',
    'grated',
    'shredded',
    'crushed',
    'whole',
    'ground',
    'raw',
    'cooked',
    'large',
    'small',
    'medium',
    'extra',
    'fine',
    'finely',
    'roughly',
    'thinly',
    'thickly',
    'boneless',
    'skinless',
    'peeled',
    'unpeeled',
    'ripe',
    'green',
  ];

  const descriptorPattern = new RegExp(`\\b(${descriptors.join('|')})\\b`, 'gi');
  parsed = parsed.replace(descriptorPattern, '');

  // Remove special characters and extra spaces
  parsed = parsed.replace(/[,()[\]]/g, ' ');
  parsed = parsed.replace(/\s+/g, ' ').trim();

  const words = parsed.split(' ').filter(Boolean);
  return words.length > 0 ? words.join(' ') : ingredient.toLowerCase();
}

/**
 * Match recipe ingredients against user's inventory
 */
function getMissingIngredients(recipeIngredients: string[], inventoryItems: any[]): string[] {
  const missing: string[] = [];

  for (const ingredient of recipeIngredients) {
    const parsedIngredient = parseIngredientName(ingredient);

    // Check if user has this ingredient
    const hasIt = inventoryItems.some((item) => {
      const inventoryName = (
        item.ingredient?.display_name ||
        item.ingredient?.name ||
        ''
      ).toLowerCase();

      return inventoryName.includes(parsedIngredient) || parsedIngredient.includes(inventoryName);
    });

    if (!hasIt) {
      missing.push(ingredient);
    }
  }

  return missing;
}

/**
 * Get user's available ingredient names for substitution availability check
 */
function getUserIngredientNames(inventoryItems: any[]): string[] {
  return inventoryItems.map((item) => item.ingredient?.display_name || item.ingredient?.name || '');
}

export function SubstitutionSuggestionsWrapper({
  recipeId,
  recipeName,
  ingredients,
  className = '',
}: SubstitutionSuggestionsWrapperProps) {
  const { isLoaded, user } = useSessionUser();
  const signedIn = user !== null;
  const userId = user?.id ?? null;
  const [missingIngredients, setMissingIngredients] = useState<string[]>([]);
  const [userIngredients, setUserIngredients] = useState<string[]>([]);
  // #67: the auth identity the inventory check last finished for; stale data is never rendered
  const authKey = `${signedIn ? 'in' : 'out'}:${userId ?? ''}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    // #67: auth state is unknown while the session loads; do nothing until it is known
    if (!isLoaded) return;
    async function checkInventory() {
      // Not signed in: show all ingredients as missing
      if (!signedIn || !userId) {
        setMissingIngredients(ingredients);
        setLoadedKey(authKey);
        return;
      }

      try {
        const result = await getUserInventory();

        if (result.success && 'data' in result && result.data && result.data.length > 0) {
          // User has inventory - determine missing ingredients
          const missing = getMissingIngredients(ingredients, result.data);
          const available = getUserIngredientNames(result.data);

          setMissingIngredients(missing);
          setUserIngredients(available);
        } else {
          // Empty inventory - all ingredients are missing
          setMissingIngredients(ingredients);
        }
      } catch (err) {
        console.error('Failed to check inventory for substitutions:', err);
        // On error, assume all ingredients are missing
        setMissingIngredients(ingredients);
      } finally {
        setLoadedKey(authKey);
      }
    }

    checkInventory();
  }, [isLoaded, signedIn, userId, authKey, ingredients]);

  // Don't render anything while loading inventory check
  // #67: also wait for auth, or a signed-in user is seeded into click-to-load mode
  if (!isLoaded || loadedKey !== authKey) {
    return null;
  }

  // Don't render if no missing ingredients (user has everything!)
  if (missingIngredients.length === 0) {
    return null;
  }

  return (
    <SubstitutionSuggestions
      // #67: remount on sign-in/out so the click-to-load seed is re-evaluated
      key={signedIn ? 'in' : 'out'}
      missingIngredients={missingIngredients}
      recipeName={recipeName}
      userIngredients={userIngredients}
      className={className}
      // #67: signed-out visitors must click before any paid AI call is made
      loadOnClick={!signedIn}
    />
  );
}
