#!/usr/bin/env tsx

/**
 * Find Possessive Variants
 *
 * Looks for ingredients where apostrophe removal leaves an extra "s"
 * Example: "angel's hair" → "angelshair" vs "angel hair" → "angelhair"
 */

import { sql } from 'drizzle-orm';
import { ingredients } from '@/lib/db/ingredients-schema';
import { db } from './db-with-transactions';

interface PossessiveVariant {
  withPossessive: {
    name: string;
    display_name: string;
    usage_count: number;
    id: string;
  };
  withoutPossessive: {
    name: string;
    display_name: string;
    usage_count: number;
    id: string;
  };
  normalizedBase: string;
}

/**
 * Advanced normalization that handles possessives
 */
function normalizeWithPossessiveHandling(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']s\b/g, '') // Remove possessive 's
    .replace(/['']s(?=\s)/g, '') // Remove possessive 's before space
    .replace(/['']s$/g, '') // Remove possessive 's at end
    .replace(/[''`]/g, '') // Remove remaining apostrophes
    .replace(/[-_\s]/g, '') // Remove separators
    .trim();
}

/**
 * Basic normalization (current method)
 */
function normalizeBasic(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_\s]/g, '')
    .replace(/[''`]/g, '')
    .trim();
}

async function findPossessiveVariants() {
  console.log('🔍 Finding Possessive Variants\n');
  console.log('='.repeat(80));

  // Get all ingredients
  const allIngredients = await db
    .select({
      name: ingredients.name,
      display_name: ingredients.display_name,
      usage_count: ingredients.usage_count,
      id: ingredients.id,
    })
    .from(ingredients)
    .orderBy(sql`${ingredients.usage_count} DESC`);

  console.log(`\nTotal ingredients: ${allIngredients.length}\n`);

  // Build maps for both normalization methods
  const basicMap = new Map<string, typeof allIngredients>();
  const advancedMap = new Map<string, typeof allIngredients>();

  for (const ing of allIngredients) {
    // Basic normalization
    const basic = normalizeBasic(ing.name);
    const basicList = basicMap.get(basic) || [];
    basicList.push(ing);
    basicMap.set(basic, basicList);

    // Advanced normalization
    const advanced = normalizeWithPossessiveHandling(ing.name);
    const advancedList = advancedMap.get(advanced) || [];
    advancedList.push(ing);
    advancedMap.set(advanced, advancedList);
  }

  // Find variants that would be caught by advanced but not basic
  const possessiveVariants: PossessiveVariant[] = [];

  for (const [normalized, variants] of advancedMap.entries()) {
    if (variants.length > 1) {
      // Check if basic normalization would miss this
      const basicNormalizations = variants.map((v) => normalizeBasic(v.name));
      const uniqueBasicNorms = [...new Set(basicNormalizations)];

      if (uniqueBasicNorms.length > 1) {
        // Find the possessive vs non-possessive pair
        const withApostrophe = variants.find((v) => v.name.includes("'") || v.name.includes("'"));
        const withoutApostrophe = variants.find(
          (v) => !v.name.includes("'") && !v.name.includes("'")
        );

        if (withApostrophe && withoutApostrophe) {
          possessiveVariants.push({
            withPossessive: withApostrophe,
            withoutPossessive: withoutApostrophe,
            normalizedBase: normalized,
          });
        }
      }
    }
  }

  // Sort by total usage
  possessiveVariants.sort(
    (a, b) =>
      b.withPossessive.usage_count +
      b.withoutPossessive.usage_count -
      (a.withPossessive.usage_count + a.withoutPossessive.usage_count)
  );

  console.log(`\n📊 POSSESSIVE VARIANTS FOUND: ${possessiveVariants.length}\n`);
  console.log('='.repeat(80));

  if (possessiveVariants.length > 0) {
    console.log('\nThese variants would be merged with improved normalization:\n');

    possessiveVariants.forEach((variant, idx) => {
      const totalUsage = variant.withPossessive.usage_count + variant.withoutPossessive.usage_count;

      console.log(
        `${idx + 1}. "${variant.withoutPossessive.name}" vs "${variant.withPossessive.name}"`
      );
      console.log(`   Normalized base: "${variant.normalizedBase}"`);
      console.log(
        `   Usage: ${variant.withoutPossessive.usage_count} vs ${variant.withPossessive.usage_count} (Total: ${totalUsage})`
      );

      // Show normalization comparison
      const basic1 = normalizeBasic(variant.withoutPossessive.name);
      const basic2 = normalizeBasic(variant.withPossessive.name);
      const advanced1 = normalizeWithPossessiveHandling(variant.withoutPossessive.name);
      const advanced2 = normalizeWithPossessiveHandling(variant.withPossessive.name);

      console.log(
        `   Basic norm:    "${basic1}" vs "${basic2}" → ${basic1 === basic2 ? '✅ MATCH' : '❌ NO MATCH'}`
      );
      console.log(
        `   Advanced norm: "${advanced1}" vs "${advanced2}" → ${advanced1 === advanced2 ? '✅ MATCH' : '❌ NO MATCH'}`
      );
      console.log();
    });
  }

  // ============================================================================
  // PLURAL/SINGULAR VARIANTS
  // ============================================================================
  console.log('\n\n📊 PLURAL/SINGULAR VARIANTS\n');
  console.log('='.repeat(80));

  const pluralVariants: Array<{
    singular: string;
    plural: string;
    singularUsage: number;
    pluralUsage: number;
  }> = [];

  // Simple plural detection (ends with 's')
  for (const [_normalized, variants] of advancedMap.entries()) {
    if (variants.length === 2) {
      const sorted = [...variants].sort((a, b) => a.name.length - b.name.length);
      const [shorter, longer] = sorted;

      // Check if longer is just shorter + 's'
      if (longer.name === `${shorter.name}s`) {
        pluralVariants.push({
          singular: shorter.name,
          plural: longer.name,
          singularUsage: shorter.usage_count,
          pluralUsage: longer.usage_count,
        });
      }
    }
  }

  // Sort by total usage
  pluralVariants.sort(
    (a, b) => b.singularUsage + b.pluralUsage - (a.singularUsage + a.pluralUsage)
  );

  console.log(`\nFound ${pluralVariants.length} plural/singular pairs\n`);

  if (pluralVariants.length > 0) {
    console.log('Top 15 by usage:\n');

    pluralVariants.slice(0, 15).forEach((variant, idx) => {
      const totalUsage = variant.singularUsage + variant.pluralUsage;
      console.log(`${idx + 1}. "${variant.singular}" vs "${variant.plural}"`);
      console.log(
        `   Usage: ${variant.singularUsage} vs ${variant.pluralUsage} (Total: ${totalUsage})`
      );
    });
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n\n📊 SUMMARY\n');
  console.log('='.repeat(80));

  console.log(`\nPossessive Variants ('s):     ${possessiveVariants.length}`);
  console.log(`Plural/Singular Variants:     ${pluralVariants.length}`);
  console.log(`Total Variants Found:         ${possessiveVariants.length + pluralVariants.length}`);

  const totalUsage =
    possessiveVariants.reduce(
      (sum, v) => sum + v.withPossessive.usage_count + v.withoutPossessive.usage_count,
      0
    ) + pluralVariants.reduce((sum, v) => sum + v.singularUsage + v.pluralUsage, 0);

  console.log(`Total Usage Affected:         ${totalUsage}`);

  console.log(`\n${'='.repeat(80)}`);
  console.log('Analysis complete! ✅\n');

  process.exit(0);
}

findPossessiveVariants().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
