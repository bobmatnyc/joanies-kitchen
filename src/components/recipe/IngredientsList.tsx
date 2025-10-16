'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Parsed ingredient structure
 */
export interface ParsedIngredient {
  original: string;
  amount?: string;
  ingredient: string;
  preparation?: string;
}

/**
 * Common measurement units for ingredient parsing
 */
const UNITS = [
  // Volume
  'cup', 'cups', 'c',
  'tablespoon', 'tablespoons', 'tbsp', 'tbs', 'T',
  'teaspoon', 'teaspoons', 'tsp', 't',
  'fluid ounce', 'fluid ounces', 'fl oz', 'fl. oz.',
  'milliliter', 'milliliters', 'ml', 'mL',
  'liter', 'liters', 'l', 'L',
  'pint', 'pints', 'pt',
  'quart', 'quarts', 'qt',
  'gallon', 'gallons', 'gal',
  // Weight
  'pound', 'pounds', 'lb', 'lbs',
  'ounce', 'ounces', 'oz',
  'gram', 'grams', 'g',
  'kilogram', 'kilograms', 'kg',
  'milligram', 'milligrams', 'mg',
  // Other
  'piece', 'pieces', 'pc',
  'slice', 'slices',
  'clove', 'cloves',
  'stick', 'sticks',
  'can', 'cans',
  'jar', 'jars',
  'package', 'packages', 'pkg',
  'bunch', 'bunches',
  'sprig', 'sprigs',
  'pinch', 'pinches',
  'dash', 'dashes',
  'handful', 'handfuls',
];

/**
 * Common preparation methods that typically appear at the end
 */
const PREPARATIONS = [
  'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded',
  'crushed', 'mashed', 'pureed', 'ground', 'crumbled',
  'melted', 'softened', 'beaten', 'whipped', 'whisked',
  'sifted', 'divided', 'separated', 'peeled', 'seeded',
  'halved', 'quartered', 'cubed', 'julienned',
  'room temperature', 'at room temperature',
  'finely chopped', 'coarsely chopped', 'roughly chopped',
  'thinly sliced', 'thickly sliced',
  'freshly ground', 'freshly grated',
  'optional', 'to taste', 'as needed', 'for garnish', 'for serving',
];

/**
 * Parse a single ingredient string into structured components
 */
export function parseIngredient(ingredientStr: string): ParsedIngredient {
  const original = ingredientStr.trim();
  let remaining = original;
  let amount: string | undefined;
  let preparation: string | undefined;

  // Handle empty or whitespace-only strings
  if (!remaining) {
    return { original, ingredient: '' };
  }

  // Step 1: Extract amount (numbers, fractions, ranges at the start)
  // Matches: "2", "1/2", "1-2", "2.5", "½", "1 ½", etc.
  const amountPattern = /^([\d½¼¾⅓⅔⅛⅜⅝⅞]+(?:\s*[-\/]\s*[\d½¼¾⅓⅔⅛⅜⅝⅞]+)?(?:\.\d+)?)\s*/;
  const amountMatch = remaining.match(amountPattern);

  if (amountMatch) {
    let amountText = amountMatch[1].trim();
    remaining = remaining.slice(amountMatch[0].length).trim();

    // Step 2: Extract unit if present
    const unitsPattern = new RegExp(`^(${UNITS.join('|')})(?:\\s+|$)`, 'i');
    const unitMatch = remaining.match(unitsPattern);

    if (unitMatch) {
      amountText += ' ' + unitMatch[1];
      remaining = remaining.slice(unitMatch[0].length).trim();
    }

    amount = amountText;
  } else {
    // Check for text-based amounts: "a", "an", "one", "some", "few", etc.
    const textAmountPattern = /^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|some|few|several)\s+/i;
    const textAmountMatch = remaining.match(textAmountPattern);

    if (textAmountMatch) {
      let amountText = textAmountMatch[1];
      remaining = remaining.slice(textAmountMatch[0].length).trim();

      // Check for unit after text amount
      const unitsPattern = new RegExp(`^(${UNITS.join('|')})(?:\\s+|$)`, 'i');
      const unitMatch = remaining.match(unitsPattern);

      if (unitMatch) {
        amountText += ' ' + unitMatch[1];
        remaining = remaining.slice(unitMatch[0].length).trim();

        // Handle "of" after unit (e.g., "a handful of fresh basil")
        if (remaining.startsWith('of ')) {
          remaining = remaining.slice(3).trim();
        }
      }

      amount = amountText;
    }
  }

  // Step 3: Extract preparation methods from the end
  // Split by comma or parentheses to check the last parts
  const parts = remaining.split(/[,(]/).map(p => p.replace(/[)]/, '').trim());

  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].toLowerCase();

    // Check if last part matches a preparation method
    const matchedPrep = PREPARATIONS.find(prep =>
      lastPart === prep.toLowerCase() ||
      lastPart.endsWith(prep.toLowerCase())
    );

    if (matchedPrep) {
      preparation = parts.pop();
      remaining = parts.join(', ').trim();
    }
  }

  // If no comma-separated preparation found, check for common patterns at the end
  if (!preparation) {
    const prepPattern = new RegExp(`[,\\s]+(${PREPARATIONS.join('|')})$`, 'i');
    const prepMatch = remaining.match(prepPattern);

    if (prepMatch) {
      preparation = prepMatch[1];
      remaining = remaining.slice(0, prepMatch.index).trim();
    }
  }

  // Step 4: What remains is the ingredient name
  const ingredient = remaining.trim() || original;

  return {
    original,
    amount,
    ingredient,
    preparation,
  };
}

/**
 * IngredientsList component props
 */
interface IngredientsListProps {
  ingredients: string[];
  showCheckboxes?: boolean;
  className?: string;
}

/**
 * Enhanced ingredients list with intelligent parsing and formatting
 *
 * Parses ingredient strings into structured components:
 * - Amount: "2 cups", "1/2 tsp", "a handful"
 * - Ingredient: "all-purpose flour", "fresh basil"
 * - Preparation: "chopped", "at room temperature"
 *
 * Features:
 * - Visual distinction between components
 * - Optional checkboxes for shopping/cooking mode
 * - Graceful fallback for unparsed ingredients
 * - Handles ranges, fractions, and text amounts
 * - Responsive and accessible
 */
export function IngredientsList({
  ingredients,
  showCheckboxes = false,
  className = '',
}: IngredientsListProps) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const handleCheckChange = (index: number, checked: boolean) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  };

  if (!ingredients || ingredients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No ingredients listed</p>
    );
  }

  return (
    <ul className={`space-y-2 ${className}`} role="list">
      {ingredients.map((ingredientStr, index) => {
        const parsed = parseIngredient(ingredientStr);
        const isChecked = checkedItems.has(index);

        return (
          <li
            key={index}
            className="flex items-start gap-3 group"
            role="listitem"
          >
            {showCheckboxes ? (
              <Checkbox
                id={`ingredient-${index}`}
                checked={isChecked}
                onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                className="mt-1"
                aria-label={`Mark ${parsed.ingredient} as completed`}
              />
            ) : (
              <span
                className="inline-block w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0"
                aria-hidden="true"
              />
            )}

            <label
              htmlFor={showCheckboxes ? `ingredient-${index}` : undefined}
              className={`flex-1 ${showCheckboxes ? 'cursor-pointer' : ''} ${
                isChecked ? 'line-through opacity-60' : ''
              }`}
            >
              {/* If parsing succeeded, show structured format */}
              {parsed.amount || parsed.preparation ? (
                <span className="inline">
                  {parsed.amount && (
                    <span className="font-semibold text-foreground">
                      {parsed.amount}{' '}
                    </span>
                  )}
                  <span className="text-foreground">
                    {parsed.ingredient}
                  </span>
                  {parsed.preparation && (
                    <span className="text-muted-foreground italic">
                      {', '}{parsed.preparation}
                    </span>
                  )}
                </span>
              ) : (
                // Fallback: show original string
                <span className="text-foreground">
                  {parsed.original}
                </span>
              )}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Export parsing function for use in other components
 */
export { parseIngredient as parseIngredientString };
