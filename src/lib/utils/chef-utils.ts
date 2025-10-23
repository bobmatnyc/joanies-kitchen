/**
 * Chef-related utility functions
 */

const SUSTAINABILITY_KEYWORDS = [
  'sustainability',
  'sustainable',
  'zero-waste',
  'food waste',
  'waste reduction',
  'eco',
  'ecological',
  'environmental',
  'farm-to-table',
  'garden-to-table',
  'local',
  'seasonal',
  'regenerative',
  'composting',
];

/**
 * Determines if a chef is focused on sustainability/food waste based on their specialties
 * @param specialties - Array of chef specialties
 * @returns true if chef is sustainability-focused
 */
export function isSustainabilityFocused(specialties: string[] | null): boolean {
  if (!specialties || specialties.length === 0) {
    return false;
  }

  return specialties.some((specialty) => {
    const specialtyLower = specialty.toLowerCase();
    return SUSTAINABILITY_KEYWORDS.some((keyword) => specialtyLower.includes(keyword));
  });
}

/**
 * Returns the sustainability verification tooltip message
 */
export function getSustainabilityTooltip(): string {
  return 'Verified sustainability & zero-waste expert';
}
