/**
 * Phase 1: Export & Analyze Ingredient Duplicates
 *
 * Identifies potential duplicate ingredients using normalization heuristics:
 * - Lowercase + remove plurals + strip punctuation
 * - Groups variants for LLM analysis
 * - Exports to tmp/potential-duplicates.json
 *
 * Usage: tsx scripts/analyze-ingredient-duplicates.ts
 */

import { db, cleanup } from './db-with-transactions';
import { ingredients } from '@/lib/db/ingredients-schema';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

interface IngredientVariant {
  id: string;
  name: string;
  display_name: string;
  category: string | null;
  usage_count: number;
  aliases: string[] | null;
}

interface DuplicateGroup {
  normalized_key: string;
  count: number;
  variants: IngredientVariant[];
  total_usage: number;
}

function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['''`]/g, '') // Remove apostrophes
    .replace(/[–—-]/g, ' ') // Replace dashes with spaces
    .replace(/ies$/, 'y') // chilies -> chily
    .replace(/s$/, '') // Remove trailing 's' for plurals
    .replace(/[^a-z0-9\s]/g, ' ') // Remove all non-alphanumeric except spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

async function exportIngredientsForAnalysis() {
  console.log('📊 Analyzing ingredients for potential duplicates...\n');

  // Fetch all ingredients
  const allIngredients = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      display_name: ingredients.display_name,
      category: ingredients.category,
      usage_count: ingredients.usage_count,
      aliases: ingredients.aliases,
    })
    .from(ingredients)
    .orderBy(sql`${ingredients.name}`);

  console.log(`Total ingredients in database: ${allIngredients.length}\n`);

  // Group by normalized names
  const groups = new Map<string, IngredientVariant[]>();

  for (const ing of allIngredients) {
    const normalized = normalizeIngredientName(ing.name);

    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }

    // Parse aliases if they exist
    let parsedAliases: string[] | null = null;
    if (ing.aliases) {
      try {
        parsedAliases = JSON.parse(ing.aliases);
      } catch (e) {
        // Ignore parse errors
      }
    }

    groups.get(normalized)!.push({
      id: ing.id,
      name: ing.name,
      display_name: ing.display_name,
      category: ing.category,
      usage_count: ing.usage_count || 0,
      aliases: parsedAliases,
    });
  }

  // Filter for groups with >1 variant (potential duplicates)
  const duplicateGroups: DuplicateGroup[] = Array.from(groups.entries())
    .filter(([_, variants]) => variants.length > 1)
    .map(([normalized, variants]) => ({
      normalized_key: normalized,
      count: variants.length,
      variants: variants.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0)), // Sort by usage
      total_usage: variants.reduce((sum, v) => sum + (v.usage_count || 0), 0),
    }))
    .sort((a, b) => b.total_usage - a.total_usage); // Prioritize high-usage duplicates

  // Ensure tmp directory exists
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // Export to JSON
  const outputPath = path.join(tmpDir, 'potential-duplicates.json');
  fs.writeFileSync(outputPath, JSON.stringify(duplicateGroups, null, 2));

  // Generate summary statistics
  const totalVariants = duplicateGroups.reduce((sum, g) => sum + g.count, 0);
  const potentialSavings = duplicateGroups.reduce((sum, g) => sum + (g.count - 1), 0);
  const highImpactGroups = duplicateGroups.filter((g) => g.total_usage > 10);

  console.log('✅ Analysis Complete!\n');
  console.log('📈 Summary Statistics:');
  console.log(`   - Duplicate groups found: ${duplicateGroups.length}`);
  console.log(`   - Total variant ingredients: ${totalVariants}`);
  console.log(`   - Potential ingredients to consolidate: ${potentialSavings}`);
  console.log(`   - High-impact groups (>10 recipes): ${highImpactGroups.length}\n`);

  // Show top 10 duplicates
  console.log('🔍 Top 10 Duplicate Groups (by total usage):\n');
  duplicateGroups.slice(0, 10).forEach((group, idx) => {
    console.log(`${idx + 1}. "${group.normalized_key}" (${group.count} variants, ${group.total_usage} total uses)`);
    group.variants.forEach((v) => {
      console.log(`   - "${v.display_name}" [${v.category || 'uncategorized'}] (${v.usage_count} recipes)`);
    });
    console.log('');
  });

  console.log(`📁 Full analysis exported to: ${outputPath}\n`);

  await cleanup();
}

// Run if executed directly
if (require.main === module) {
  exportIngredientsForAnalysis().catch((error) => {
    console.error('❌ Error analyzing duplicates:', error);
    process.exit(1);
  });
}

export { exportIngredientsForAnalysis, normalizeIngredientName };
export type { DuplicateGroup, IngredientVariant };
