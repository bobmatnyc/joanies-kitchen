/**
 * Tag System V2 - ID-Based Hierarchical Tags with Localization
 *
 * This is the main entry point for the new tag system.
 *
 * Key Features:
 * - Hierarchical tag structure (category.subcategory?.item)
 * - Multi-language support (en, es, fr)
 * - 11 tag categories (Cuisine, Meal Type, Course, Dish Type, Dietary, etc.)
 * - Backward compatibility with old string tags
 * - Type-safe tag IDs
 *
 * Quick Start:
 * ```typescript
 * import { TAG_IDS, getTagLabel, normalizeTagToId } from '@/lib/tags';
 *
 * // Use type-safe tag IDs
 * const tags = [TAG_IDS.CUISINE.ITALIAN, TAG_IDS.DIFFICULTY.BEGINNER];
 *
 * // Get localized labels
 * const label = getTagLabel(TAG_IDS.CUISINE.ITALIAN, 'en'); // "Italian"
 *
 * // Migrate old tags
 * const newTag = normalizeTagToId('italian'); // "cuisine.italian"
 * ```
 */

// Export tag IDs and types
export { TagCategory, TAG_IDS, type TagId, type KnownTagId } from './tag-ids';
export {
  getCategoryFromTagId,
  isHierarchicalTag,
  getParentTagId,
  getTagIdsByCategory,
  isKnownTagId,
} from './tag-ids';

// Export hierarchy
export { TAG_HIERARCHY, type TagNode } from './tag-hierarchy';
export {
  getTagNode,
  getChildTags,
  getParentTag,
  getRelatedTagNodes,
  getTagSynonyms,
  findTagIdBySynonym,
  isParentTag,
  isChildTag,
  getAncestors,
  getDescendants,
} from './tag-hierarchy';

// Export localization
export { TAG_LABELS, type TagLabel, type Locale } from './tag-localization';
export {
  getTagLabel,
  getTagDescription,
  hasTagLabel,
  getAvailableLocales,
  getCurrentLocale,
} from './tag-localization';

// Export migration utilities
export { MigrationStrategy, type MigrationConfig, type MigrationReport } from './tag-migration';
export {
  normalizeTagToId,
  normalizeTags,
  tagIdToLegacy,
  tagIdsToLegacy,
  isNewFormat,
  migrateTags,
  batchMigrateTags,
  generateMigrationReport,
  printMigrationReport,
  deduplicateTags,
  validateTagIds,
} from './tag-migration';
