#!/usr/bin/env tsx
/**
 * Analyze Ingredient Name Inconsistencies
 *
 * Investigates duplicate ingredient variants that should be normalized,
 * focusing on punctuation differences (apostrophes, hyphens, etc.)
 */

import { db } from './db-with-transactions';
import { ingredients } from '@/lib/db/ingredients-schema';
import { sql } from 'drizzle-orm';
import { areVariants, calculateSimilarity } from '@/lib/ingredients/fuzzy-matching';

interface IngredientVariant {
  name: string;
  display_name: string;
  usage_count: number;
  id: string;
  category: string | null;
}

interface VariantGroup {
  normalizedName: string;
  variants: IngredientVariant[];
  totalUsage: number;
  pattern: string;
}

/**
 * Normalize ingredient name for comparison
 * Removes punctuation, spaces, and converts to lowercase
 */
function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_\s]/g, '')     // Remove separators
    .replace(/[''`]/g, '')       // Remove all apostrophe variants
    .replace(/[.,!?;:()]/g, ''); // Remove other punctuation
}

/**
 * Detect pattern type for variant
 */
function detectPattern(name: string): string[] {
  const patterns: string[] = [];

  if (name.includes("'") || name.includes("'")) patterns.push('apostrophe');
  if (name.includes('-')) patterns.push('hyphen');
  if (name.includes('_')) patterns.push('underscore');
  if (/\s+/.test(name)) patterns.push('space');
  if (name !== name.toLowerCase()) patterns.push('capitalization');
  if (/s$/.test(name.toLowerCase())) patterns.push('plural');

  return patterns;
}

async function analyzeIngredientVariants() {
  console.log('🔍 Analyzing Ingredient Name Inconsistencies\n');
  console.log('='.repeat(80));

  // ============================================================================
  // 1. FIND INGREDIENTS WITH APOSTROPHES
  // ============================================================================
  console.log('\n📊 1. INGREDIENTS WITH APOSTROPHES\n');

  const withApostrophes = await db
    .select({
      name: ingredients.name,
      display_name: ingredients.display_name,
      usage_count: ingredients.usage_count,
      id: ingredients.id,
      category: ingredients.category,
    })
    .from(ingredients)
    .where(sql`${ingredients.name} ~ E'[\\'\\']'`)
    .orderBy(sql`${ingredients.usage_count} DESC`);

  console.log(`Total ingredients with apostrophes: ${withApostrophes.length}\n`);

  if (withApostrophes.length > 0) {
    console.log('Top 20 by usage count:');
    console.log('-'.repeat(80));
    withApostrophes.slice(0, 20).forEach((ing, idx) => {
      console.log(`${idx + 1}. "${ing.name}" (${ing.display_name})`);
      console.log(`   Usage: ${ing.usage_count}, Category: ${ing.category || 'N/A'}`);
    });
  }

  // ============================================================================
  // 2. FIND POTENTIAL APOSTROPHE DUPLICATES
  // ============================================================================
  console.log('\n\n📊 2. POTENTIAL APOSTROPHE DUPLICATES\n');

  const apostropheDuplicates: VariantGroup[] = [];

  // Get all ingredients for comparison
  const allIngredients = await db
    .select({
      name: ingredients.name,
      display_name: ingredients.display_name,
      usage_count: ingredients.usage_count,
      id: ingredients.id,
      category: ingredients.category,
    })
    .from(ingredients)
    .orderBy(sql`${ingredients.usage_count} DESC`);

  // Build normalized name map
  const normalizedMap = new Map<string, IngredientVariant[]>();

  for (const ing of allIngredients) {
    const normalized = normalizeForComparison(ing.name);
    const existing = normalizedMap.get(normalized) || [];
    existing.push(ing);
    normalizedMap.set(normalized, existing);
  }

  // Find groups with multiple variants
  for (const [normalized, variants] of normalizedMap.entries()) {
    if (variants.length > 1) {
      // Check if apostrophes are involved
      const hasApostropheVariant = variants.some(v =>
        v.name.includes("'") || v.name.includes("'")
      );

      if (hasApostropheVariant) {
        const totalUsage = variants.reduce((sum, v) => sum + v.usage_count, 0);
        const patterns = [...new Set(variants.flatMap(v => detectPattern(v.name)))];

        apostropheDuplicates.push({
          normalizedName: normalized,
          variants,
          totalUsage,
          pattern: patterns.join(', '),
        });
      }
    }
  }

  // Sort by total usage
  apostropheDuplicates.sort((a, b) => b.totalUsage - a.totalUsage);

  console.log(`Found ${apostropheDuplicates.length} apostrophe variant groups\n`);

  if (apostropheDuplicates.length > 0) {
    console.log('Top 15 by usage impact:');
    console.log('='.repeat(80));

    apostropheDuplicates.slice(0, 15).forEach((group, idx) => {
      console.log(`\n${idx + 1}. Group: "${group.normalizedName}" (Total usage: ${group.totalUsage})`);
      console.log(`   Patterns: ${group.pattern}`);
      console.log(`   Variants (${group.variants.length}):`);

      group.variants.forEach((variant, vIdx) => {
        const patterns = detectPattern(variant.name).join(', ');
        console.log(`      ${vIdx + 1}. "${variant.name}" → "${variant.display_name}"`);
        console.log(`         Usage: ${variant.usage_count}, Pattern: [${patterns}]`);
      });
    });
  }

  // ============================================================================
  // 3. FIND OTHER PUNCTUATION VARIANTS
  // ============================================================================
  console.log('\n\n📊 3. OTHER PUNCTUATION VARIANTS (Hyphens, Underscores)\n');

  const allDuplicates: VariantGroup[] = [];

  for (const [normalized, variants] of normalizedMap.entries()) {
    if (variants.length > 1) {
      const totalUsage = variants.reduce((sum, v) => sum + v.usage_count, 0);
      const patterns = [...new Set(variants.flatMap(v => detectPattern(v.name)))];

      // Skip if already in apostrophe group
      if (apostropheDuplicates.some(g => g.normalizedName === normalized)) {
        continue;
      }

      allDuplicates.push({
        normalizedName: normalized,
        variants,
        totalUsage,
        pattern: patterns.join(', '),
      });
    }
  }

  // Sort by total usage
  allDuplicates.sort((a, b) => b.totalUsage - a.totalUsage);

  console.log(`Found ${allDuplicates.length} other variant groups\n`);

  if (allDuplicates.length > 0) {
    console.log('Top 15 by usage impact:');
    console.log('='.repeat(80));

    allDuplicates.slice(0, 15).forEach((group, idx) => {
      console.log(`\n${idx + 1}. Group: "${group.normalizedName}" (Total usage: ${group.totalUsage})`);
      console.log(`   Patterns: ${group.pattern}`);
      console.log(`   Variants (${group.variants.length}):`);

      group.variants.forEach((variant, vIdx) => {
        const patterns = detectPattern(variant.name).join(', ');
        console.log(`      ${vIdx + 1}. "${variant.name}" → "${variant.display_name}"`);
        console.log(`         Usage: ${variant.usage_count}, Pattern: [${patterns}]`);
      });
    });
  }

  // ============================================================================
  // 4. FUZZY MATCHING ALGORITHM ANALYSIS
  // ============================================================================
  console.log('\n\n📊 4. FUZZY MATCHING ALGORITHM TEST\n');
  console.log('='.repeat(80));

  // Test cases
  const testCases = [
    ["Angel Hair Pasta", "Angel's Hair Pasta"],
    ["Green Onion", "Green Onions"],
    ["Soy Sauce", "Soy-Sauce"],
    ["All Purpose Flour", "All-Purpose Flour"],
    ["Chicken Breast", "Chicken Breasts"],
  ];

  console.log('\nTesting areVariants() function:\n');

  for (const [name1, name2] of testCases) {
    const isVariant = areVariants(name1, name2);
    const similarity = calculateSimilarity(name1, name2);
    const norm1 = normalizeForComparison(name1);
    const norm2 = normalizeForComparison(name2);

    console.log(`"${name1}" vs "${name2}"`);
    console.log(`  areVariants: ${isVariant ? '✅ YES' : '❌ NO'}`);
    console.log(`  Similarity: ${(similarity * 100).toFixed(1)}%`);
    console.log(`  Normalized: "${norm1}" vs "${norm2}"`);
    console.log(`  Match: ${norm1 === norm2 ? '✅' : '❌'}`);
    console.log();
  }

  // ============================================================================
  // 5. SUMMARY STATISTICS
  // ============================================================================
  console.log('\n\n📊 5. SUMMARY STATISTICS\n');
  console.log('='.repeat(80));

  const totalIngredients = allIngredients.length;
  const totalDuplicateGroups = apostropheDuplicates.length + allDuplicates.length;
  const totalVariantIngredients = [...apostropheDuplicates, ...allDuplicates]
    .reduce((sum, g) => sum + g.variants.length, 0);
  const totalAffectedUsage = [...apostropheDuplicates, ...allDuplicates]
    .reduce((sum, g) => sum + g.totalUsage, 0);

  console.log(`Total Ingredients:           ${totalIngredients}`);
  console.log(`Duplicate Variant Groups:    ${totalDuplicateGroups}`);
  console.log(`Ingredients in Variants:     ${totalVariantIngredients}`);
  console.log(`Redundant Entries:           ${totalVariantIngredients - totalDuplicateGroups}`);
  console.log(`Total Affected Usage:        ${totalAffectedUsage}`);
  console.log(`Percentage with Variants:    ${((totalVariantIngredients / totalIngredients) * 100).toFixed(2)}%`);

  // Pattern breakdown
  const patternCounts = new Map<string, number>();

  for (const group of [...apostropheDuplicates, ...allDuplicates]) {
    for (const pattern of group.pattern.split(', ')) {
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
    }
  }

  console.log('\n\nPattern Distribution:');
  console.log('-'.repeat(80));
  for (const [pattern, count] of [...patternCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pattern.padEnd(20)} ${count} groups`);
  }

  // ============================================================================
  // 6. RECOMMENDATIONS
  // ============================================================================
  console.log('\n\n📋 6. RECOMMENDATIONS\n');
  console.log('='.repeat(80));

  console.log(`
Priority 1: FIX HIGH-IMPACT APOSTROPHE VARIANTS (🔴 CRITICAL)
  - ${apostropheDuplicates.length} groups found with apostrophes
  - Top 10 groups account for ${apostropheDuplicates.slice(0, 10).reduce((s, g) => s + g.totalUsage, 0)} total usages
  - ACTION: Update fuzzy-matching.ts to normalize apostrophes more aggressively

Priority 2: RE-RUN CONSOLIDATION WITH IMPROVED NORMALIZATION (🟡 HIGH)
  - Current areVariants() function DOES handle apostrophes (line 126)
  - But may have issues with different apostrophe types: ' vs '
  - ACTION: Update normalization to handle both ' and ' and \` apostrophes

Priority 3: FIX OTHER PUNCTUATION VARIANTS (🟡 HIGH)
  - ${allDuplicates.length} groups found with other punctuation differences
  - Includes hyphens, underscores, spaces
  - ACTION: Re-run consolidation script after fixing normalization

Priority 4: PREVENT FUTURE DUPLICATES (🟢 MEDIUM)
  - Add validation at ingredient ingestion
  - Normalize all ingredient names before insertion
  - Check for existing normalized variants
  - ACTION: Add pre-insert normalization hook

Recommended Next Steps:
  1. Fix normalizeForComparison() in fuzzy-matching.ts to handle ' and '
  2. Run consolidation script with --dry-run to preview merges
  3. Execute consolidation to merge duplicates
  4. Update ingredient extraction to use normalization
  5. Add database constraint to prevent future duplicates
  `);

  console.log('\n' + '='.repeat(80));
  console.log('Analysis complete! ✅\n');

  process.exit(0);
}

// Run analysis
analyzeIngredientVariants().catch((error) => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});
