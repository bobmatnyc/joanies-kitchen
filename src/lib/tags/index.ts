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

// Export hierarchy
export {
  findTagIdBySynonym,
  getAncestors,
  getChildTags,
  getDescendants,
  getParentTag,
  getRelatedTagNodes,
  getTagNode,
  getTagSynonyms,
  isChildTag,
  isParentTag,
  TAG_HIERARCHY,
  type TagNode,
} from './tag-hierarchy';
// Export tag IDs and types
export {
  getCategoryFromTagId,
  getParentTagId,
  getTagIdsByCategory,
  isHierarchicalTag,
  isKnownTagId,
  type KnownTagId,
  TAG_IDS,
  TagCategory,
  type TagId,
} from './tag-ids';
// Export localization
export {
  getAvailableLocales,
  getCurrentLocale,
  getTagDescription,
  getTagLabel,
  hasTagLabel,
  type Locale,
  TAG_LABELS,
  type TagLabel,
} from './tag-localization';
// Export migration utilities
export {
  batchMigrateTags,
  deduplicateTags,
  generateMigrationReport,
  isNewFormat,
  type MigrationConfig,
  type MigrationReport,
  MigrationStrategy,
  migrateTags,
  normalizeTags,
  normalizeTagToId,
  printMigrationReport,
  tagIdsToLegacy,
  tagIdToLegacy,
  validateTagIds,
} from './tag-migration';
