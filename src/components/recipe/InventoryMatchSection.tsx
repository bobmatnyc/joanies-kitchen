'use client';

import { useAuth } from '@clerk/nextjs';
import {
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShoppingCart,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getUserInventory } from '@/app/actions/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface IngredientMatch {
  ingredient: string;
  hasIt: boolean;
  inventoryItem?: {
    quantity: string;
    unit: string;
    status: string;
    ingredient_name: string;
  };
}

interface InventoryMatchSectionProps {
  recipeId: string;
  ingredients: string[]; // Recipe ingredient strings (JSON array)
  className?: string;
}

/**
 * InventoryMatchSection - Displays "You Have / You Need" for recipe ingredients
 *
 * Features:
 * - Fetches user's fridge inventory
 * - Matches recipe ingredients against inventory
 * - Shows match percentage
 * - Displays ingredients user has (green) vs needs (orange)
 * - Handles unauthenticated and empty inventory states
 */
export function InventoryMatchSection({
  recipeId,
  ingredients,
  className = '',
}: InventoryMatchSectionProps) {
  const { isSignedIn, userId } = useAuth();
  const [matches, setMatches] = useState<IngredientMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasInventory, setHasInventory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function checkInventory() {
      if (!isSignedIn || !userId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user's inventory
        const result = await getUserInventory();

        if (result.success && 'data' in result && result.data && result.data.length > 0) {
          setHasInventory(true);

          // Match ingredients
          const matched = matchIngredientsToInventory(ingredients, result.data);
          setMatches(matched);
        } else if (!result.success && 'error' in result) {
          setError(result.error || 'Failed to load inventory');
        }
      } catch (err) {
        console.error('Failed to check inventory:', err);
        setError('Failed to load inventory');
      } finally {
        setLoading(false);
      }
    }

    checkInventory();
  }, [isSignedIn, userId, ingredients, matchIngredientsToInventory]);

  /**
   * Match recipe ingredients to user's inventory
   * Uses fuzzy matching to handle variations in ingredient names
   */
  function matchIngredientsToInventory(
    recipeIngredients: string[],
    inventoryItems: any[]
  ): IngredientMatch[] {
    return recipeIngredients.map((ingredient) => {
      // Parse ingredient string (e.g., "2 cups flour" → "flour")
      const parsedIngredient = parseIngredientName(ingredient);

      // Find match in inventory (fuzzy match by name)
      const match = inventoryItems.find((item) => {
        const inventoryName = (
          item.ingredient?.display_name ||
          item.ingredient?.name ||
          ''
        ).toLowerCase();

        // Check if inventory item name contains parsed ingredient or vice versa
        return inventoryName.includes(parsedIngredient) || parsedIngredient.includes(inventoryName);
      });

      return {
        ingredient: ingredient,
        hasIt: !!match,
        inventoryItem: match
          ? {
              quantity: match.quantity,
              unit: match.unit,
              status: match.status,
              ingredient_name: match.ingredient?.display_name || match.ingredient?.name || '',
            }
          : undefined,
      };
    });
  }

  /**
   * Parse ingredient name from full ingredient string
   * Removes amounts, numbers, units to extract core ingredient name
   */
  function parseIngredientName(ingredient: string): string {
    // Convert to lowercase for matching
    let parsed = ingredient.toLowerCase().trim();

    // Remove common units (cups, tsp, tbsp, oz, lbs, etc.)
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

    // Remove numbers and fractions (1, 2, 1/2, 3.5, etc.)
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

    // Return the first significant word group (usually the core ingredient)
    const words = parsed.split(' ').filter(Boolean);
    return words.length > 0 ? words.join(' ') : ingredient.toLowerCase();
  }

  // Calculate match statistics
  const haveCount = matches.filter((m) => m.hasIt).length;
  const needCount = matches.filter((m) => !m.hasIt).length;
  const totalCount = matches.length;
  const matchPercentage = totalCount > 0 ? Math.round((haveCount / totalCount) * 100) : 0;

  // Loading state
  if (loading) {
    return (
      <Card className={`border-2 ${className}`}>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Not signed in state
  if (!isSignedIn) {
    return (
      <Card className={`border-2 border-jk-sage ${className}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-jk-sage" />
            Ingredient Match
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Sign in to see which ingredients you already have in your fridge!
          </p>
          <Button asChild className="w-full bg-jk-sage hover:bg-jk-sage/90">
            <Link href={`/sign-in?redirect=/recipes/${recipeId}`}>
              Sign in to see what you have
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty inventory state
  if (!hasInventory && !loading) {
    return (
      <Card className={`border-2 border-jk-sage ${className}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-jk-sage" />
            Ingredient Match
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Your fridge is empty! Add ingredients to see what you have for this recipe.
          </p>
          <Button
            asChild
            variant="outline"
            className="w-full border-jk-sage text-jk-sage hover:bg-jk-sage/10"
          >
            <Link href="/fridge">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add ingredients to your fridge
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={`border-2 border-destructive/20 ${className}`}>
        <CardContent className="py-6">
          <p className="text-sm text-destructive text-center">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Main content with matches
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`border-2 border-jk-sage ${className}`}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left hover:opacity-80 transition-opacity">
              <CardTitle className="text-lg flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-jk-sage" />
                Ingredient Match
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge
                  variant={matchPercentage >= 70 ? 'default' : 'secondary'}
                  className={
                    matchPercentage >= 70
                      ? 'bg-green-600 hover:bg-green-600/90'
                      : matchPercentage >= 50
                        ? 'bg-orange-500 hover:bg-orange-500/90'
                        : 'bg-gray-500'
                  }
                >
                  {matchPercentage}% Match
                </Badge>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Summary Stats */}
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">{haveCount}</div>
                <div className="text-muted-foreground">You Have</div>
              </div>
              <div className="text-muted-foreground text-xl">/</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-700">{needCount}</div>
                <div className="text-muted-foreground">You Need</div>
              </div>
            </div>

            {/* You Have Section (Green) */}
            {haveCount > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  You Have ({haveCount})
                </h3>
                <div className="space-y-1 bg-green-50 rounded-lg p-3 border border-green-200">
                  {matches
                    .filter((m) => m.hasIt)
                    .map((match, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-green-900">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="flex-1">{match.ingredient}</span>
                        {match.inventoryItem && (
                          <span className="text-xs text-green-700 shrink-0">
                            ({match.inventoryItem.quantity} {match.inventoryItem.unit})
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* You Need Section (Orange) */}
            {needCount > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-orange-700 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  You Need ({needCount})
                </h3>
                <div className="space-y-1 bg-orange-50 rounded-lg p-3 border border-orange-200">
                  {matches
                    .filter((m) => !m.hasIt)
                    .map((match, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-orange-900">
                        <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{match.ingredient}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                asChild
                variant="outline"
                className="flex-1 border-jk-sage text-jk-sage hover:bg-jk-sage/10"
              >
                <Link href="/fridge">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Update Fridge
                </Link>
              </Button>
              {needCount > 0 && (
                <Button
                  asChild
                  variant="default"
                  className="flex-1 bg-orange-600 hover:bg-orange-600/90"
                >
                  <Link href="/fridge">Add Missing Items</Link>
                </Button>
              )}
            </div>

            {/* Helpful Tip */}
            {matchPercentage >= 70 && (
              <div className="text-xs text-center text-muted-foreground pt-2 border-t">
                Great match! You have most ingredients ready to cook.
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
