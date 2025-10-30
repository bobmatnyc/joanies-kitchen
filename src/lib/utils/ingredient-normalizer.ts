/**
 * Ingredient Name Normalization Utilities
 *
 * Normalizes ingredient names for shopping lists by removing usage-specific notes
 * and consolidating similar ingredients into purchaseable units.
 *
 * Example: "neutral oil (for chicken)" → "neutral oil"
 */

/**
 * Remove usage notes and preparation details from ingredient names
 * Handles patterns like:
 * - "ingredient (for something)" → "ingredient"
 * - "ingredient, for something" → "ingredient"
 * - "ingredient - for something" → "ingredient"
 * - "1 medium onion, roughly chopped" → "1 medium onion"
 * - "3.5 tablespoons jarred black bean garlic sauce (Lee Kum Kee)" → "jar of Lee Kum Kee black bean garlic sauce"
 */
export function normalizeIngredientName(name: string): string {
  if (!name) return name;

  let normalized = name;

  // Remove parenthetical usage notes: "neutral oil (for chicken)" → "neutral oil"
  // But preserve brand names: "sauce (Lee Kum Kee)" → keep brand
  const parentheticalMatch = normalized.match(/\(([^)]+)\)/);
  if (parentheticalMatch) {
    const content = parentheticalMatch[1];
    // Keep if it looks like a brand name (capitalized words) or "or similar"
    if (
      !/^for |^to |^as /i.test(content) &&
      (content.match(/[A-Z]/) || content.includes('similar'))
    ) {
      // Keep the brand name but move it to the front if it's a jarred/canned item
      if (normalized.match(/tablespoons?\s+jarred|canned|bottled/i)) {
        // Convert "3.5 tablespoons jarred sauce (Brand)" to "jar of Brand sauce"
        normalized = convertToContainerUnit(normalized);
      }
    } else {
      // Remove usage notes
      normalized = normalized.replace(/\s*\([^)]*\)\s*/g, ' ');
    }
  }

  // Remove preparation instructions after comma
  // "onion, roughly chopped" → "onion"
  // "onion, chopped" → "onion"
  normalized = normalized.replace(
    /,\s*(roughly\s+|finely\s+|thinly\s+|thickly\s+)?(\w+ed|sliced|diced|chopped|minced|grated|shredded|cubed)(\s+.*)?$/i,
    ''
  );

  // Remove usage notes after comma: "oil, for chicken" → "oil"
  normalized = normalized.replace(/,\s*(for|to|as)\s+[^,]+$/i, '');

  // Remove usage notes after dash: "oil - for chicken" → "oil"
  normalized = normalized.replace(/\s*-\s*(for|to|as)\s+.+$/i, '');

  // Trim extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Normalize common variations to standard names
  normalized = normalizeCommonVariations(normalized);

  return normalized;
}

/**
 * Convert tablespoon/teaspoon measurements of jarred/canned items to container units
 * "3.5 tablespoons jarred black bean garlic sauce (Lee Kum Kee)" → "jar of Lee Kum Kee black bean garlic sauce"
 */
function convertToContainerUnit(name: string): string {
  // Match patterns like "X tablespoons jarred/canned Y (Brand)"
  const match = name.match(
    /^[\d./\s]+\s*(tablespoons?|teaspoons?|cups?)\s+(jarred|canned|bottled)\s+(.+?)\s*\(([^)]+)\)/i
  );

  if (match) {
    const [, , containerType, product, brand] = match;
    const container = containerType.toLowerCase();

    // Determine purchaseable unit based on container type
    let unit = 'jar of';
    if (container === 'canned') {
      unit = 'can of';
    } else if (container === 'bottled') {
      unit = 'bottle of';
    }

    return `${unit} ${brand} ${product}`.replace(/\s+/g, ' ').trim();
  }

  return name;
}

/**
 * Normalize common ingredient variations to standard names
 */
function normalizeCommonVariations(name: string): string {
  const lowerName = name.toLowerCase();

  // Oil normalizations
  const oilNormalizations: Record<string, string> = {
    'vegetable oil': 'neutral oil',
    'canola oil': 'neutral oil',
    'grapeseed oil': 'neutral oil',
    'sunflower oil': 'neutral oil',
    'safflower oil': 'neutral oil',
    'extra virgin olive oil': 'olive oil',
    evoo: 'olive oil',
  };

  // Check oil normalizations
  for (const [variant, standard] of Object.entries(oilNormalizations)) {
    if (lowerName === variant || lowerName.startsWith(`${variant} `)) {
      return standard + name.slice(variant.length);
    }
  }

  // Salt normalizations
  if (lowerName.includes('kosher salt') || lowerName.includes('sea salt')) {
    return 'salt';
  }

  // Pepper normalizations
  if (lowerName.includes('black pepper') || lowerName.includes('ground pepper')) {
    return 'black pepper';
  }

  // Butter normalizations
  if (lowerName.includes('unsalted butter')) {
    return 'butter, unsalted';
  }

  // No normalization needed
  return name;
}

/**
 * Consolidate usage notes from multiple instances
 * Useful for showing what the ingredient is used for in the shopping list notes
 */
export function extractUsageNotes(originalName: string): string | null {
  if (!originalName) return null;

  // Extract parenthetical notes
  const parentheticalMatch = originalName.match(/\(([^)]+)\)/);
  if (parentheticalMatch) {
    return parentheticalMatch[1];
  }

  // Extract comma-separated notes
  const commaMatch = originalName.match(/,\s*(for|to|as)\s+(.+)$/i);
  if (commaMatch) {
    return commaMatch[2];
  }

  // Extract dash-separated notes
  const dashMatch = originalName.match(/-\s*(for|to|as)\s+(.+)$/i);
  if (dashMatch) {
    return dashMatch[2];
  }

  return null;
}

/**
 * Consolidate multiple usage notes into a readable format
 */
export function consolidateUsageNotes(notes: (string | null)[]): string | null {
  const validNotes = notes.filter((note): note is string => note !== null && note.length > 0);

  if (validNotes.length === 0) return null;
  if (validNotes.length === 1) return `for ${validNotes[0]}`;

  // Remove duplicates and sort
  const uniqueNotes = Array.from(new Set(validNotes)).sort();

  if (uniqueNotes.length === 1) return `for ${uniqueNotes[0]}`;
  if (uniqueNotes.length === 2) return `for ${uniqueNotes[0]} and ${uniqueNotes[1]}`;

  // More than 2 uses
  return `for ${uniqueNotes.slice(0, -1).join(', ')}, and ${uniqueNotes[uniqueNotes.length - 1]}`;
}
