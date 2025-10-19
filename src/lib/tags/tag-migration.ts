/**
 * Tag Migration Utilities
 *
 * Provides backward compatibility between old string tags and new ID-based tags
 * Supports dual-mode operation during transition period
 */

import type { TagId } from './tag-ids';
import { TAG_HIERARCHY, findTagIdBySynonym } from './tag-hierarchy';

/**
 * Normalize a tag to the new ID format
 *
 * Handles:
 * - Old string tags → New ID tags (via synonym matching)
 * - Already-formatted IDs → Pass through
 * - Unknown tags → Fallback to other.{tag}
 *
 * @param tag - Old string tag or new ID tag
 * @returns Normalized tag ID
 *
 * @example
 * normalizeTagToId('italian') → 'cuisine.italian'
 * normalizeTagToId('cuisine.italian') → 'cuisine.italian'
 * normalizeTagToId('unknown-tag') → 'other.unknown-tag'
 */
export function normalizeTagToId(tag: string): TagId {
  if (!tag || typeof tag !== 'string') {
    return 'other.uncategorized' as TagId;
  }

  const normalized = tag.trim().toLowerCase();

  // Check if already an ID (contains '.')
  if (normalized.includes('.')) {
    // Validate it's a known ID
    if (TAG_HIERARCHY[normalized as TagId]) {
      return normalized as TagId;
    }
    // Unknown ID format, fallback to other
    return `other.${normalized}` as TagId;
  }

  // Try to find by synonym (old string format → new ID)
  const tagId = findTagIdBySynonym(normalized);
  if (tagId) {
    return tagId;
  }

  // Fallback: create an other.{tag} ID
  return `other.${normalized}` as TagId;
}

/**
 * Normalize an array of tags
 *
 * @param tags - Array of old string tags or new ID tags
 * @returns Array of normalized tag IDs
 *
 * @example
 * normalizeTags(['italian', 'easy', 'pasta'])
 * → ['cuisine.italian', 'difficulty.beginner', 'mainIngredient.grain.pasta']
 */
export function normalizeTags(tags: string[]): TagId[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .filter((tag) => tag && typeof tag === 'string')
    .map((tag) => normalizeTagToId(tag));
}

/**
 * Convert a tag ID back to a legacy string format
 * Useful for displaying or exporting to old systems
 *
 * @param tagId - New ID tag
 * @returns Legacy string tag (last part of ID)
 *
 * @example
 * tagIdToLegacy('cuisine.italian') → 'italian'
 * tagIdToLegacy('difficulty.beginner') → 'beginner'
 */
export function tagIdToLegacy(tagId: TagId): string {
  const parts = tagId.split('.');
  return parts[parts.length - 1];
}

/**
 * Convert array of tag IDs to legacy format
 *
 * @param tagIds - Array of new ID tags
 * @returns Array of legacy string tags
 */
export function tagIdsToLegacy(tagIds: TagId[]): string[] {
  return tagIds.map((tagId) => tagIdToLegacy(tagId));
}

/**
 * Check if a tag is in old format (string) or new format (ID)
 *
 * @param tag - Tag to check
 * @returns True if tag is in new ID format
 */
export function isNewFormat(tag: string): boolean {
  return tag.includes('.');
}

/**
 * Migration strategy enum
 */
export enum MigrationStrategy {
  /** Keep both old and new formats */
  DUAL = 'dual',
  /** Only use new format */
  NEW_ONLY = 'new_only',
  /** Only use old format (legacy) */
  OLD_ONLY = 'old_only',
}

/**
 * Migration configuration
 */
export interface MigrationConfig {
  /** Migration strategy to use */
  strategy: MigrationStrategy;
  /** Whether to log migration actions */
  verbose?: boolean;
  /** Custom synonym mappings (old → new) */
  customSynonyms?: Record<string, TagId>;
}

/**
 * Migrate tags based on configuration
 *
 * @param tags - Array of tags (old or new format)
 * @param config - Migration configuration
 * @returns Migrated tags based on strategy
 */
export function migrateTags(
  tags: string[],
  config: MigrationConfig = { strategy: MigrationStrategy.NEW_ONLY }
): string[] {
  const { strategy, verbose, customSynonyms } = config;

  if (strategy === MigrationStrategy.OLD_ONLY) {
    // Convert all to legacy format
    const legacyTags = tags.map((tag) => {
      if (isNewFormat(tag)) {
        return tagIdToLegacy(tag as TagId);
      }
      return tag;
    });

    if (verbose) {
      console.log('[Tag Migration] Converted to legacy format:', legacyTags);
    }

    return legacyTags;
  }

  if (strategy === MigrationStrategy.NEW_ONLY) {
    // Convert all to new format
    const newTags = tags.map((tag) => {
      // Check custom synonyms first
      if (customSynonyms && customSynonyms[tag]) {
        return customSynonyms[tag];
      }
      return normalizeTagToId(tag);
    });

    if (verbose) {
      console.log('[Tag Migration] Converted to new format:', newTags);
    }

    return newTags;
  }

  if (strategy === MigrationStrategy.DUAL) {
    // Keep both formats (for transition period)
    const normalizedTags = tags.map((tag) => {
      if (customSynonyms && customSynonyms[tag]) {
        return customSynonyms[tag];
      }
      return normalizeTagToId(tag);
    });

    // Add legacy versions
    const legacyTags = normalizedTags.map((tag) => tagIdToLegacy(tag as TagId));

    // Combine and deduplicate
    const allTags = [...new Set([...normalizedTags, ...legacyTags])];

    if (verbose) {
      console.log('[Tag Migration] Dual format:', allTags);
    }

    return allTags;
  }

  return tags;
}

/**
 * Batch migration for database records
 *
 * Use this for migrating existing recipes from old tag format to new
 *
 * @param records - Array of records with tags field
 * @param config - Migration configuration
 * @returns Updated records with migrated tags
 */
export function batchMigrateTags<T extends { tags: string }>(
  records: T[],
  config: MigrationConfig = { strategy: MigrationStrategy.NEW_ONLY }
): T[] {
  return records.map((record) => {
    try {
      // Parse tags (assuming JSON array in string)
      const tags = JSON.parse(record.tags || '[]') as string[];

      // Migrate tags
      const migratedTags = migrateTags(tags, config);

      // Return updated record
      return {
        ...record,
        tags: JSON.stringify(migratedTags),
      };
    } catch (error) {
      console.error('[Tag Migration] Failed to migrate record:', record, error);
      return record; // Return unchanged on error
    }
  });
}

/**
 * Create a migration report
 * Useful for understanding the impact of migration
 *
 * @param tags - Array of old tags
 * @returns Migration statistics
 */
export interface MigrationReport {
  /** Total tags processed */
  total: number;
  /** Tags successfully mapped to new IDs */
  mapped: number;
  /** Tags with no mapping (fallback to other.*) */
  unmapped: number;
  /** Tags already in new format */
  alreadyNew: number;
  /** List of unmapped tags */
  unmappedTags: string[];
  /** Mapping results */
  mappings: Array<{ old: string; new: TagId }>;
}

/**
 * Generate migration report
 *
 * @param tags - Array of tags to analyze
 * @returns Detailed migration report
 */
export function generateMigrationReport(tags: string[]): MigrationReport {
  const report: MigrationReport = {
    total: tags.length,
    mapped: 0,
    unmapped: 0,
    alreadyNew: 0,
    unmappedTags: [],
    mappings: [],
  };

  for (const tag of tags) {
    const normalized = normalizeTagToId(tag);

    if (isNewFormat(tag)) {
      report.alreadyNew++;
    } else if (normalized.startsWith('other.')) {
      report.unmapped++;
      report.unmappedTags.push(tag);
    } else {
      report.mapped++;
    }

    report.mappings.push({ old: tag, new: normalized });
  }

  return report;
}

/**
 * Print migration report to console
 *
 * @param report - Migration report
 */
export function printMigrationReport(report: MigrationReport): void {
  console.log('=== Tag Migration Report ===');
  console.log(`Total tags: ${report.total}`);
  console.log(`Successfully mapped: ${report.mapped} (${((report.mapped / report.total) * 100).toFixed(1)}%)`);
  console.log(`Already new format: ${report.alreadyNew} (${((report.alreadyNew / report.total) * 100).toFixed(1)}%)`);
  console.log(`Unmapped (fallback to other.*): ${report.unmapped} (${((report.unmapped / report.total) * 100).toFixed(1)}%)`);

  if (report.unmappedTags.length > 0) {
    console.log('\nUnmapped tags:');
    report.unmappedTags.forEach((tag) => console.log(`  - ${tag}`));
  }

  console.log('\nSample mappings:');
  report.mappings.slice(0, 10).forEach(({ old, new: newTag }) => {
    console.log(`  ${old} → ${newTag}`);
  });
}

/**
 * Helper: Deduplicate tags
 * Removes duplicate tags (case-insensitive)
 *
 * @param tags - Array of tags
 * @returns Deduplicated tags
 */
export function deduplicateTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    const normalized = tag.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(tag);
    }
  }

  return result;
}

/**
 * Helper: Validate tag IDs
 * Check if all tags are valid known IDs
 *
 * @param tags - Array of tag IDs
 * @returns Object with validation results
 */
export function validateTagIds(tags: TagId[]): {
  valid: TagId[];
  invalid: TagId[];
  warnings: string[];
} {
  const valid: TagId[] = [];
  const invalid: TagId[] = [];
  const warnings: string[] = [];

  for (const tag of tags) {
    if (TAG_HIERARCHY[tag]) {
      valid.push(tag);
    } else if (tag.startsWith('other.')) {
      valid.push(tag);
      warnings.push(`Tag "${tag}" uses fallback category 'other'`);
    } else {
      invalid.push(tag);
    }
  }

  return { valid, invalid, warnings };
}
