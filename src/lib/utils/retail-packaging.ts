/**
 * Retail Packaging Utilities
 *
 * Converts recipe quantities to typical retail packaging sizes
 * Configuration is loaded from retail-packages.json for easy expansion
 */

import retailPackagesConfig from './retail-packages.json';

interface RetailPackage {
  quantity: number;
  unit: string;
  originalQuantity: number;
  originalUnit: string;
}

/**
 * Load retail packages configuration from JSON
 * Flattens the categorized structure into a flat lookup map
 */
function loadRetailPackages(): Record<string, { size: number; unit: string; category: string }[]> {
  const packages: Record<string, { size: number; unit: string; category: string }[]> = {};

  // Flatten all categories except produce (produce has different structure)
  for (const [category, items] of Object.entries(retailPackagesConfig)) {
    if (category === 'produce') continue; // Handle produce separately

    for (const [itemName, packageSizes] of Object.entries(items as Record<string, any>)) {
      packages[itemName] = packageSizes;
    }
  }

  return packages;
}

/**
 * Load produce items configuration from JSON
 */
function loadProduceItems(): Record<string, { slicesPerUnit: number; unit: string }> {
  return retailPackagesConfig.produce as Record<string, { slicesPerUnit: number; unit: string }>;
}

// Load configurations at module level
const RETAIL_PACKAGES = loadRetailPackages();
const PRODUCE_ITEMS = loadProduceItems();

/**
 * Convert fluid ounces to cups
 */
function ozToCups(oz: number): number {
  return oz / 8;
}

/**
 * Convert cups to fluid ounces
 */
function cupsToOz(cups: number): number {
  return cups * 8;
}

/**
 * Check if a word boundary exists for better matching
 */
function hasWordMatch(text: string, searchTerm: string): boolean {
  // Create regex that matches whole words or at word boundaries
  const regex = new RegExp(`\\b${searchTerm}\\b`, 'i');
  return regex.test(text);
}

/**
 * Find the appropriate retail package size for an ingredient
 */
export function convertToRetailPackaging(
  ingredientName: string,
  quantity: number,
  unit: string
): RetailPackage | null {
  const normalizedName = ingredientName.toLowerCase().trim();
  const normalizedUnit = unit.toLowerCase().trim();

  // Check for piece/slice units and convert to whole produce items
  const isPieceUnit =
    normalizedUnit.includes('piece') ||
    normalizedUnit.includes('slice') ||
    normalizedUnit === 'pc' ||
    normalizedUnit === 'pcs';

  if (isPieceUnit) {
    // Find matching produce item
    const matchingProduce = Object.entries(PRODUCE_ITEMS).find(([key]) =>
      normalizedName.includes(key)
    );

    if (matchingProduce) {
      const [, produceInfo] = matchingProduce;
      // Calculate whole units needed
      const wholeUnitsNeeded = Math.ceil(quantity / produceInfo.slicesPerUnit);

      return {
        quantity: wholeUnitsNeeded,
        unit: wholeUnitsNeeded === 1 ? produceInfo.unit : `${produceInfo.unit}s`,
        originalQuantity: quantity,
        originalUnit: unit,
      };
    }
  }

  // Find matching retail package with better word matching
  const matchingPackages = Object.entries(RETAIL_PACKAGES).find(([key]) => {
    // For multi-word keys, check if all words are present
    if (key.includes(' ')) {
      return normalizedName.includes(key);
    }
    // For single words, use word boundary matching to avoid false matches
    // e.g., "cinnamon" should not match "red cinnamon candies"
    return hasWordMatch(normalizedName, key);
  });

  if (!matchingPackages) {
    return null;
  }

  const [matchedKey, packages] = matchingPackages;
  const packageInfo = packages[0]; // Use first package for category check

  // Special handling for spices: always show "1 jar" regardless of small quantity
  if (packageInfo.category === 'spice') {
    // For spices in teaspoon/tablespoon quantities, just show "1 jar"
    if (
      normalizedUnit.includes('teaspoon') ||
      normalizedUnit.includes('tablespoon') ||
      normalizedUnit === 'tsp' ||
      normalizedUnit === 'tbsp'
    ) {
      return {
        quantity: 1,
        unit: packageInfo.unit,
        originalQuantity: quantity,
        originalUnit: unit,
      };
    }
  }

  // Convert quantity to ounces if in cups
  let quantityInOz = quantity;
  if (unit.toLowerCase().includes('cup')) {
    quantityInOz = cupsToOz(quantity);
  } else if (!unit.toLowerCase().includes('oz') && !unit.toLowerCase().includes('ounce')) {
    // If not in cups or ounces, can't convert
    return null;
  }

  // Find the smallest package that fits the needed quantity
  const sortedPackages = packages.sort((a, b) => a.size - b.size);
  const selectedPackage = sortedPackages.find((pkg) => pkg.size >= quantityInOz);

  if (!selectedPackage) {
    // Need more than largest package, calculate how many
    const largestPackage = sortedPackages[sortedPackages.length - 1];
    const packagesNeeded = Math.ceil(quantityInOz / largestPackage.size);
    return {
      quantity: packagesNeeded,
      unit: largestPackage.unit,
      originalQuantity: quantity,
      originalUnit: unit,
    };
  }

  return {
    quantity: 1,
    unit: selectedPackage.unit,
    originalQuantity: quantity,
    originalUnit: unit,
  };
}

/**
 * Format shopping list item with retail packaging
 */
export function formatShoppingListItem(
  ingredientName: string,
  quantity: number,
  unit: string
): string {
  const retailPackage = convertToRetailPackaging(ingredientName, quantity, unit);

  if (!retailPackage) {
    // No retail packaging found, use original format
    if (quantity > 0) {
      return `${quantity} ${unit} ${ingredientName}`;
    }
    return ingredientName;
  }

  // Format: "1 container sour cream (need 1 cup)"
  const packageText = `${retailPackage.quantity} ${retailPackage.unit}${retailPackage.quantity > 1 ? 's' : ''}`;
  const needText = `need ${retailPackage.originalQuantity} ${retailPackage.originalUnit}`;

  return `${packageText} ${ingredientName} (${needText})`;
}
