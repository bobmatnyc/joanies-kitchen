#!/usr/bin/env tsx

/**
 * Export Low-Quality Recipes for Manual Review
 *
 * Exports recipes rated 2.0-2.9 (Fair quality) to JSON/CSV for manual review.
 * These recipes may be salvageable with cleanup or may need removal.
 *
 * Usage:
 *   npx tsx scripts/export-low-quality-recipes.ts                # Export to JSON
 *   npx tsx scripts/export-low-quality-recipes.ts --format=csv   # Export to CSV
 *   npx tsx scripts/export-low-quality-recipes.ts --threshold=3.0  # Custom threshold
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db';

interface ExportOptions {
  format: 'json' | 'csv';
  threshold: number;
}

/**
 * Generate timestamp for filenames
 */
function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

/**
 * Export recipes to JSON
 */
async function exportToJSON(recipes: any[], filePath: string): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(recipes, null, 2));
}

/**
 * Export recipes to CSV
 */
async function exportToCSV(recipes: any[], filePath: string): Promise<void> {
  const headers = [
    'ID',
    'Name',
    'Rating',
    'Reason',
    'Source',
    'User ID',
    'Created At',
    'Ingredients Count',
    'Instructions Count',
  ];

  const rows = recipes.map((r) => [
    r.id,
    `"${r.name.replace(/"/g, '""')}"`,
    Number(r.system_rating).toFixed(1),
    `"${(r.system_rating_reason || '').replace(/"/g, '""')}"`,
    `"${(r.source || 'Unknown').replace(/"/g, '""')}"`,
    r.user_id,
    new Date(r.created_at).toISOString(),
    r.ingredient_count || 0,
    r.instruction_count || 0,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  await fs.writeFile(filePath, csvContent);
}

/**
 * Main export function
 */
async function exportRecipes(options: ExportOptions) {
  const timestamp = getTimestamp();

  console.log('📤 Export Low-Quality Recipes for Review');
  console.log('=========================================\n');
  console.log(`Format: ${options.format.toUpperCase()}`);
  console.log(`Threshold: Exporting recipes with rating 2.0 - ${options.threshold}\n`);

  try {
    // Fetch recipes for review
    console.log('📊 Fetching recipes for manual review...');
    const reviewRecipes = await db.execute(sql`
      SELECT
        r.id,
        r.name,
        r.system_rating,
        r.system_rating_reason,
        r.source,
        r.user_id,
        r.created_at,
        r.description,
        r.ingredients,
        r.instructions,
        r.prep_time,
        r.cook_time,
        r.servings,
        r.difficulty,
        r.cuisine,
        r.tags
      FROM recipes r
      WHERE r.system_rating >= 2.0 AND r.system_rating < ${options.threshold}
      ORDER BY r.system_rating ASC
    `);

    const total = reviewRecipes.rows.length;

    if (total === 0) {
      console.log('\n✅ No recipes found in this range. All recipes are high quality!');
      return;
    }

    console.log(`Found ${total} recipes for review\n`);

    // Process recipes for export
    const exportData = reviewRecipes.rows.map((recipe: any) => {
      let ingredients: string[] = [];
      let instructions: string[] = [];

      try {
        ingredients = JSON.parse(recipe.ingredients);
      } catch {}

      try {
        instructions = JSON.parse(recipe.instructions);
      } catch {}

      return {
        id: recipe.id,
        name: recipe.name,
        rating: Number(recipe.system_rating),
        rating_reason: recipe.system_rating_reason,
        source: recipe.source || 'Unknown',
        user_id: recipe.user_id,
        created_at: recipe.created_at,
        description: recipe.description,
        ingredients: ingredients,
        ingredient_count: ingredients.length,
        instructions: instructions,
        instruction_count: instructions.length,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        cuisine: recipe.cuisine,
        tags: recipe.tags ? JSON.parse(recipe.tags) : [],
      };
    });

    // Create export directory
    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });

    // Export based on format
    let exportPath: string;

    if (options.format === 'json') {
      exportPath = path.join(tmpDir, `review-recipes-${timestamp}.json`);
      await exportToJSON(exportData, exportPath);
    } else {
      exportPath = path.join(tmpDir, `review-recipes-${timestamp}.csv`);
      await exportToCSV(exportData, exportPath);
    }

    console.log('✅ Export complete!\n');
    console.log('📊 Summary:');
    console.log('========');
    console.log(`  Total recipes: ${total.toLocaleString()}`);
    console.log(`  Format: ${options.format.toUpperCase()}`);
    console.log(`  File: ${exportPath}`);

    // Show rating breakdown
    const ratingBreakdown = exportData.reduce((acc: any, recipe: any) => {
      const ratingBucket = Math.floor(recipe.rating * 10) / 10;
      acc[ratingBucket] = (acc[ratingBucket] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📈 Rating Distribution:');
    Object.keys(ratingBreakdown)
      .sort()
      .forEach((rating) => {
        const count = ratingBreakdown[rating];
        const percentage = ((count / total) * 100).toFixed(1);
        console.log(
          `  ${Number(rating).toFixed(1)}: ${count.toString().padStart(4)} recipes (${percentage}%)`
        );
      });

    // Show source breakdown
    const sourceBreakdown = exportData.reduce((acc: any, recipe: any) => {
      const source = recipe.source || 'Unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📦 Source Breakdown:');
    Object.entries(sourceBreakdown)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([source, count]) => {
        const percentage = ((Number(count) / total) * 100).toFixed(1);
        console.log(
          `  ${String(source).substring(0, 40).padEnd(40)} ${String(count).padStart(4)} recipes (${percentage}%)`
        );
      });

    console.log('\n💡 Next Steps:');
    console.log('============');
    console.log('1. Review exported recipes in spreadsheet or JSON viewer');
    console.log('2. Identify recipes that can be improved with cleanup');
    console.log('3. Mark recipes for removal');
    console.log('4. Run cleanup script: npx tsx scripts/cleanup-recipe-content.ts --execute');
    console.log('5. Run removal script: npx tsx scripts/remove-low-quality-recipes.ts --execute');

    console.log('\n📝 Review Criteria:');
    console.log('==================');
    console.log('- Missing or vague ingredient measurements');
    console.log('- Unclear or incomplete instructions');
    console.log('- Missing critical information (times, temperatures)');
    console.log('- Poor formatting or structure');
    console.log('- Duplicate or near-duplicate recipes');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
const formatArg = args.find((a) => a.startsWith('--format='))?.split('=')[1] || 'json';
const thresholdArg = args.find((a) => a.startsWith('--threshold='))?.split('=')[1];

const options: ExportOptions = {
  format: (formatArg === 'csv' ? 'csv' : 'json') as 'json' | 'csv',
  threshold: thresholdArg ? parseFloat(thresholdArg) : 3.0,
};

// Validate threshold
if (Number.isNaN(options.threshold) || options.threshold < 2.0 || options.threshold > 5.0) {
  console.error('❌ Invalid threshold. Must be between 2.0 and 5.0');
  process.exit(1);
}

// Run
exportRecipes(options)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
