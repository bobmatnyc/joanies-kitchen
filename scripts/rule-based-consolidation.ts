/**
 * Phase 2 Alternative: Rule-Based Consolidation Decision
 *
 * Uses deterministic rules to analyze duplicate groups and decide merges:
 * - Plural/singular variants
 * - Punctuation variants
 * - Category duplicates
 * - Zero-usage duplicates
 *
 * No LLM required - completely rule-based and deterministic.
 *
 * Usage: tsx scripts/rule-based-consolidation.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DuplicateGroup, IngredientVariant } from './analyze-ingredient-duplicates';

interface ConsolidationDecision {
  group: string;
  action: 'merge' | 'keep_separate' | 'needs_review';
  canonical_id?: string;
  canonical_name?: string;
  canonical_category?: string;
  duplicates_to_merge?: string[];
  reason: string;
  aliases?: string[];
  confidence?: 'high' | 'medium' | 'low';
}

const CATEGORY_HIERARCHY: Record<string, number> = {
  // More specific categories ranked higher
  vegetables: 10,
  fruits: 10,
  herbs: 10,
  spices: 10,
  meats: 9,
  seafood: 9,
  poultry: 9,
  proteins: 8,
  dairy: 8,
  nuts: 8,
  grains: 7,
  pasta: 7,
  legumes: 7,
  oils: 6,
  condiments: 6,
  sweeteners: 6,
  baking: 5,
  beverages: 5,
  tools: 4,
  other: 1,
};

function selectCanonicalCategory(variants: IngredientVariant[]): string {
  // If all same category, use that
  const categories = new Set(variants.map((v) => v.category).filter(Boolean));
  if (categories.size === 1) {
    return Array.from(categories)[0] || 'other';
  }

  // Prefer category with highest usage
  const categoryUsage = new Map<string, number>();
  variants.forEach((v) => {
    if (v.category) {
      categoryUsage.set(v.category, (categoryUsage.get(v.category) || 0) + v.usage_count);
    }
  });

  // Sort by usage, then by hierarchy rank
  const sortedCategories = Array.from(categoryUsage.entries()).sort((a, b) => {
    // First by usage count
    if (b[1] !== a[1]) return b[1] - a[1];
    // Then by hierarchy
    return (CATEGORY_HIERARCHY[b[0]] || 0) - (CATEGORY_HIERARCHY[a[0]] || 0);
  });

  return sortedCategories[0]?.[0] || 'other';
}

function selectCanonicalName(variants: IngredientVariant[]): string {
  // Prefer the variant with highest usage
  const sorted = [...variants].sort((a, b) => b.usage_count - a.usage_count);

  // If clear winner by usage (>50% of total), use that
  const totalUsage = variants.reduce((sum, v) => sum + v.usage_count, 0);
  if (sorted[0].usage_count > totalUsage * 0.5) {
    return sorted[0].display_name;
  }

  // Otherwise prefer plural form if available
  const pluralVariants = variants.filter((v) => v.name.endsWith('s') || v.name.includes('es'));
  if (pluralVariants.length > 0) {
    return pluralVariants.sort((a, b) => b.usage_count - a.usage_count)[0].display_name;
  }

  // Fall back to highest usage
  return sorted[0].display_name;
}

function arePluralVariants(variants: IngredientVariant[]): boolean {
  // Works for 2+ variants - check if all are just plural variations
  if (variants.length < 2) return false;

  const names = variants.map((v) => v.name.toLowerCase()).sort((a, b) => a.length - b.length);

  // Take shortest as the base (likely singular)
  const base = names[0];

  // Check if all longer variants are just plural forms of the base
  for (let i = 1; i < names.length; i++) {
    const variant = names[i];

    // Direct plural: cat -> cats
    if (variant === base + 's') continue;

    // -es plural: tomato -> tomatoes
    if (variant === base + 'es') continue;

    // -ies plural: berry -> berries
    if (base.endsWith('y') && variant === base.slice(0, -1) + 'ies') continue;

    // Not a simple plural variation
    return false;
  }

  return true;
}

function arePunctuationVariants(variants: IngredientVariant[]): boolean {
  if (variants.length > 3) return false;

  // Normalize: remove all punctuation and compare
  const normalized = variants.map((v) => v.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim());

  // All should be the same after normalization
  const uniqueNormalized = new Set(normalized);
  return uniqueNormalized.size === 1;
}

function areCategoryDuplicates(variants: IngredientVariant[]): boolean {
  // Same name (ignoring case), different categories
  const uniqueNames = new Set(variants.map((v) => v.name.toLowerCase()));
  if (uniqueNames.size !== 1) return false;

  const categories = new Set(variants.map((v) => v.category).filter(Boolean));
  return categories.size > 1;
}

function areZeroUsageDuplicates(variants: IngredientVariant[]): boolean {
  return variants.every((v) => v.usage_count === 0);
}

function shouldKeepSeparate(group: DuplicateGroup): boolean {
  const { variants } = group;

  // Don't separate if they're just plural variants
  if (arePluralVariants(variants)) {
    return false;
  }

  // Don't separate if they're category duplicates (exact same name, different categories)
  if (areCategoryDuplicates(variants)) {
    return false;
  }

  // Different semantic meanings (contains significantly different words)
  const names = variants.map((v) => v.name.toLowerCase());

  // If only 2 variants, check if one is clearly related to the other
  if (variants.length === 2) {
    const [name1, name2] = names;

    // If one name completely contains the other, they might be different
    // e.g., "red bell pepper" vs "marinated roasted bell peppers"
    const words1 = new Set(name1.split(/\s+/));
    const words2 = new Set(name2.split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));

    // If less than 30% word overlap (excluding simple plurals), keep separate
    const union = new Set([...words1, ...words2]);
    const overlapRatio = intersection.size / union.size;

    if (overlapRatio < 0.3) {
      return true;
    }
  }

  return false;
}

function analyzeGroup(group: DuplicateGroup): ConsolidationDecision {
  const { variants, normalized_key } = group;

  // Rule 1: Zero usage duplicates
  if (areZeroUsageDuplicates(variants)) {
    return {
      group: normalized_key,
      action: 'needs_review',
      reason: 'All variants have 0 usage - recommend deletion',
      confidence: 'medium',
    };
  }

  // Rule 2: Check if should keep separate
  if (shouldKeepSeparate(group)) {
    return {
      group: normalized_key,
      action: 'keep_separate',
      reason: 'Variants appear to be semantically different ingredients',
      confidence: 'medium',
    };
  }

  // Rule 3: Plural/singular variants
  if (arePluralVariants(variants)) {
    const sorted = [...variants].sort((a, b) => b.usage_count - a.usage_count);
    const canonical = sorted[0];
    const duplicate = sorted[1];

    return {
      group: normalized_key,
      action: 'merge',
      canonical_id: canonical.id,
      canonical_name: selectCanonicalName(variants),
      canonical_category: selectCanonicalCategory(variants),
      duplicates_to_merge: [duplicate.id],
      reason: 'Plural/singular variants of same ingredient',
      aliases: variants.map((v) => v.display_name).filter((n) => n !== selectCanonicalName(variants)),
      confidence: 'high',
    };
  }

  // Rule 4: Punctuation variants
  if (arePunctuationVariants(variants)) {
    const sorted = [...variants].sort((a, b) => b.usage_count - a.usage_count);
    const canonical = sorted[0];
    const duplicates = sorted.slice(1);

    return {
      group: normalized_key,
      action: 'merge',
      canonical_id: canonical.id,
      canonical_name: selectCanonicalName(variants),
      canonical_category: selectCanonicalCategory(variants),
      duplicates_to_merge: duplicates.map((v) => v.id),
      reason: 'Punctuation/spelling variants of same ingredient',
      aliases: variants.map((v) => v.display_name).filter((n) => n !== selectCanonicalName(variants)),
      confidence: 'high',
    };
  }

  // Rule 5: Category duplicates (same name, different category)
  if (areCategoryDuplicates(variants)) {
    const sorted = [...variants].sort((a, b) => b.usage_count - a.usage_count);
    const canonical = sorted[0];
    const duplicates = sorted.slice(1);

    return {
      group: normalized_key,
      action: 'merge',
      canonical_id: canonical.id,
      canonical_name: selectCanonicalName(variants),
      canonical_category: selectCanonicalCategory(variants),
      duplicates_to_merge: duplicates.map((v) => v.id),
      reason: 'Same ingredient in multiple categories - consolidating to most appropriate',
      aliases: [],
      confidence: 'high',
    };
  }

  // Rule 6: Multiple variants with usage - needs review
  return {
    group: normalized_key,
    action: 'needs_review',
    reason: 'Multiple variants with different patterns - manual review recommended',
    confidence: 'low',
  };
}

async function main() {
  const tmpDir = path.join(process.cwd(), 'tmp');
  const inputPath = path.join(tmpDir, 'potential-duplicates.json');
  const outputPath = path.join(tmpDir, 'consolidation-decisions.json');

  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    console.error('❌ Error: potential-duplicates.json not found!');
    console.error('   Run: tsx scripts/analyze-ingredient-duplicates.ts first\n');
    process.exit(1);
  }

  // Load duplicate groups
  const duplicates: DuplicateGroup[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  console.log(`📋 Loaded ${duplicates.length} duplicate groups from analysis\n`);
  console.log('🤖 Applying rule-based consolidation logic...\n');

  // Analyze each group
  const decisions: ConsolidationDecision[] = duplicates.map((group) => analyzeGroup(group));

  // Generate statistics
  const stats = {
    total: decisions.length,
    merge: decisions.filter((d) => d.action === 'merge').length,
    keep_separate: decisions.filter((d) => d.action === 'keep_separate').length,
    needs_review: decisions.filter((d) => d.action === 'needs_review').length,
    high_confidence: decisions.filter((d) => d.confidence === 'high').length,
    medium_confidence: decisions.filter((d) => d.confidence === 'medium').length,
    low_confidence: decisions.filter((d) => d.confidence === 'low').length,
  };

  // Calculate consolidation impact
  const ingredientsToDelete = decisions
    .filter((d) => d.action === 'merge' && d.duplicates_to_merge)
    .reduce((sum, d) => sum + (d.duplicates_to_merge?.length || 0), 0);

  // Save decisions
  fs.writeFileSync(outputPath, JSON.stringify(decisions, null, 2));

  console.log('✅ Rule-Based Analysis Complete!\n');
  console.log('📊 Decision Summary:');
  console.log(`   - Total decisions: ${stats.total}`);
  console.log(`   - Merge: ${stats.merge} groups`);
  console.log(`   - Keep separate: ${stats.keep_separate} groups`);
  console.log(`   - Needs review: ${stats.needs_review} groups\n`);

  console.log('🎯 Confidence Distribution:');
  console.log(`   - High: ${stats.high_confidence}`);
  console.log(`   - Medium: ${stats.medium_confidence}`);
  console.log(`   - Low: ${stats.low_confidence}\n`);

  console.log('💾 Consolidation Impact:');
  console.log(`   - Ingredients to delete: ${ingredientsToDelete}`);
  console.log(`   - Canonical ingredients to keep: ${stats.merge}\n`);

  console.log(`📁 Decisions saved to: ${outputPath}\n`);

  // Show sample high-confidence merges
  const highConfidenceMerges = decisions.filter((d) => d.action === 'merge' && d.confidence === 'high').slice(0, 10);

  if (highConfidenceMerges.length > 0) {
    console.log('✨ Sample High-Confidence Merges:\n');
    highConfidenceMerges.forEach((decision, idx) => {
      console.log(`${idx + 1}. ${decision.canonical_name} [${decision.canonical_category}]`);
      console.log(`   Reason: ${decision.reason}`);
      if (decision.aliases && decision.aliases.length > 0) {
        console.log(`   Aliases: ${decision.aliases.join(', ')}`);
      }
      console.log('');
    });
  }

  // Show items needing review
  const reviewItems = decisions.filter((d) => d.action === 'needs_review');
  if (reviewItems.length > 0) {
    console.log(`⚠️  ${reviewItems.length} groups need manual review:\n`);
    reviewItems.slice(0, 10).forEach((decision, idx) => {
      console.log(`${idx + 1}. ${decision.group}`);
      console.log(`   Reason: ${decision.reason}\n`);
    });
  }

  // Show items to keep separate
  const separateItems = decisions.filter((d) => d.action === 'keep_separate');
  if (separateItems.length > 0) {
    console.log(`📌 ${separateItems.length} groups to keep separate:\n`);
    separateItems.slice(0, 5).forEach((decision, idx) => {
      console.log(`${idx + 1}. ${decision.group}`);
      console.log(`   Reason: ${decision.reason}\n`);
    });
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error during rule-based analysis:', error);
    process.exit(1);
  });
}

export { analyzeGroup };
