/**
 * Meal Slug Generation Utility
 *
 * Generates SEO-friendly URL slugs from meal names
 * Pattern: "meal-name-YYYY" for uniqueness
 */

/**
 * Generate a slug from a meal name
 * @param name - Meal name (e.g., "Thanksgiving Dinner")
 * @param created_at - Optional creation date for uniqueness
 * @returns Slug (e.g., "thanksgiving-dinner-2024")
 */
export function generateMealSlug(name: string, created_at?: Date | string): string {
  // Normalize the name
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  // Add year suffix for uniqueness if created_at is provided
  if (created_at) {
    const date = typeof created_at === 'string' ? new Date(created_at) : created_at;
    const year = date.getFullYear();
    return `${normalized}-${year}`;
  }

  return normalized;
}

/**
 * Ensure slug uniqueness by appending a counter
 * @param baseSlug - Base slug to make unique
 * @param existingSlugs - Array of existing slugs to check against
 * @returns Unique slug
 */
export function ensureUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = baseSlug;
  let counter = 1;

  // Check if slug exists, if so append counter
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Regenerate slug from meal name (for backfilling)
 * @param name - Meal name
 * @param id - Meal UUID (for fallback)
 * @param created_at - Creation date
 * @returns Generated slug
 */
export function regenerateMealSlug(
  name: string,
  id: string,
  created_at: Date | string
): string {
  // Try to generate from name first
  const slug = generateMealSlug(name, created_at);

  // If slug is too short (< 3 chars), use ID suffix
  if (slug.length < 3) {
    return `meal-${id.slice(0, 8)}`;
  }

  return slug;
}
