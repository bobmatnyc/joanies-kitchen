/**
 * Formats quantities for display in shopping lists
 * - Removes unnecessary decimals (2.00 → 2)
 * - Formats common fractions (0.5 → ½)
 * - Keeps necessary precision (2.33 → 2⅓)
 */
export function formatQuantity(quantity: number): string {
  // Handle zero or invalid
  if (!quantity || quantity === 0) return '';

  // Remove unnecessary decimals for whole numbers
  if (quantity === Math.floor(quantity)) {
    return quantity.toString();
  }

  // Format common fractions
  const fractions: Record<string, string> = {
    '0.5': '½',
    '0.25': '¼',
    '0.75': '¾',
    '0.33': '⅓',
    '0.333': '⅓',
    '0.67': '⅔',
    '0.667': '⅔',
  };

  const rounded = quantity.toFixed(3);
  if (fractions[rounded]) {
    return fractions[rounded];
  }

  // Handle mixed numbers (e.g., 2.5 → 2½)
  const whole = Math.floor(quantity);
  const decimal = quantity - whole;

  if (whole > 0 && fractions[decimal.toFixed(3)]) {
    return `${whole}${fractions[decimal.toFixed(3)]}`;
  }

  // Keep up to 2 decimal places, remove trailing zeros
  return quantity.toFixed(2).replace(/\.?0+$/, '');
}
