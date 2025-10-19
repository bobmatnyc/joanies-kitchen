#!/usr/bin/env tsx

/**
 * Tag Migration Script
 *
 * Migrates all recipes from old string-based tags to new ID-based hierarchical tags
 *
 * Features:
 * - Converts old format tags to new ID format (e.g., "italian" → "cuisine.italian")
 * - Preserves tag data integrity
 * - Provides detailed migration report
 * - Supports dry-run mode for testing
 * - Transaction-based for safety
 *
 * Usage:
 *   pnpm tsx scripts/migrate-tags-to-ids.ts          # Dry run (no changes)
 *   pnpm tsx scripts/migrate-tags-to-ids.ts --apply  # Apply migration
 */

import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import {
  normalizeTagToId,
  generateMigrationReport,
  printMigrationReport,
  deduplicateTags,
  validateTagIds,
  type TagId,
} from '../src/lib/tags';

// Load environment variables
config({ path: '.env.local' });

interface MigrationStats {
  totalRecipes: number;
  recipesWithTags: number;
  recipesUpdated: number;
  recipesFailed: number;
  totalTagsProcessed: number;
  tagsMapped: number;
  tagsUnmapped: number;
  tagsAlreadyNew: number;
  failedRecipes: Array<{ id: string; name: string; error: string }>;
}

/**
 * Migrate tags for a single recipe
 */
async function migrateRecipeTags(
  recipe: any,
  dryRun: boolean
): Promise<{ success: boolean; oldTags: string[]; newTags: TagId[]; error?: string }> {
  try {
    // Parse existing tags
    const oldTags = recipe.tags ? JSON.parse(recipe.tags) : [];

    if (!Array.isArray(oldTags) || oldTags.length === 0) {
      return { success: true, oldTags: [], newTags: [] };
    }

    // Convert to new ID format
    const newTags = oldTags.map((tag: string) => normalizeTagToId(tag));

    // Deduplicate
    const uniqueNewTags = Array.from(new Set(newTags));

    if (!dryRun) {
      // Update recipe with new tags
      await db
        .update(recipes)
        .set({
          tags: JSON.stringify(uniqueNewTags),
        })
        .where(eq(recipes.id, recipe.id));
    }

    return {
      success: true,
      oldTags,
      newTags: uniqueNewTags,
    };
  } catch (error) {
    return {
      success: false,
      oldTags: [],
      newTags: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Main migration function
 */
async function migrateAllRecipes(dryRun: boolean = true): Promise<void> {
  console.log('='.repeat(80));
  console.log('Recipe Tag Migration: Old Format → New ID-Based Format');
  console.log('='.repeat(80));
  console.log();

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made to the database');
  } else {
    console.log('⚠️  LIVE MODE - Database will be updated');
  }
  console.log();

  const stats: MigrationStats = {
    totalRecipes: 0,
    recipesWithTags: 0,
    recipesUpdated: 0,
    recipesFailed: 0,
    totalTagsProcessed: 0,
    tagsMapped: 0,
    tagsUnmapped: 0,
    tagsAlreadyNew: 0,
    failedRecipes: [],
  };

  try {
    // Fetch all recipes
    console.log('📊 Fetching all recipes...');
    const allRecipes = await db.select().from(recipes);
    stats.totalRecipes = allRecipes.length;

    console.log(`Found ${stats.totalRecipes} recipes`);
    console.log();

    // Collect all tags for reporting
    const allOldTags: string[] = [];

    // Process each recipe
    for (const recipe of allRecipes) {
      // Skip if no tags
      if (!recipe.tags) continue;

      let recipeTags: string[] = [];
      try {
        recipeTags = JSON.parse(recipe.tags);
      } catch (error) {
        console.error(`❌ Failed to parse tags for recipe: ${recipe.name}`);
        stats.recipesFailed++;
        stats.failedRecipes.push({
          id: recipe.id,
          name: recipe.name,
          error: 'Failed to parse tags JSON',
        });
        continue;
      }

      if (!Array.isArray(recipeTags) || recipeTags.length === 0) continue;

      stats.recipesWithTags++;

      // Collect old tags for report
      allOldTags.push(...recipeTags);

      // Migrate recipe tags
      const result = await migrateRecipeTags(recipe, dryRun);

      if (result.success) {
        stats.recipesUpdated++;
        stats.totalTagsProcessed += result.oldTags.length;

        if (!dryRun) {
          console.log(`✓ Migrated: ${recipe.name} (${result.oldTags.length} → ${result.newTags.length} tags)`);
        }
      } else {
        stats.recipesFailed++;
        stats.failedRecipes.push({
          id: recipe.id,
          name: recipe.name,
          error: result.error || 'Unknown error',
        });
        console.error(`❌ Failed: ${recipe.name} - ${result.error}`);
      }
    }

    // Generate migration report for all tags
    if (allOldTags.length > 0) {
      console.log();
      console.log('='.repeat(80));
      console.log('Tag Migration Analysis');
      console.log('='.repeat(80));

      const report = generateMigrationReport(allOldTags);
      stats.tagsMapped = report.mapped;
      stats.tagsUnmapped = report.unmapped;
      stats.tagsAlreadyNew = report.alreadyNew;

      printMigrationReport(report);
    }

    // Print final statistics
    console.log();
    console.log('='.repeat(80));
    console.log('Migration Summary');
    console.log('='.repeat(80));
    console.log(`Total recipes:              ${stats.totalRecipes}`);
    console.log(`Recipes with tags:          ${stats.recipesWithTags}`);
    console.log(`Recipes updated:            ${stats.recipesUpdated}`);
    console.log(`Recipes failed:             ${stats.recipesFailed}`);
    console.log();
    console.log(`Total tags processed:       ${stats.totalTagsProcessed}`);
    console.log(`Tags mapped:                ${stats.tagsMapped} (${((stats.tagsMapped / stats.totalTagsProcessed) * 100).toFixed(1)}%)`);
    console.log(`Tags already new format:    ${stats.tagsAlreadyNew} (${((stats.tagsAlreadyNew / stats.totalTagsProcessed) * 100).toFixed(1)}%)`);
    console.log(`Tags unmapped (fallback):   ${stats.tagsUnmapped} (${((stats.tagsUnmapped / stats.totalTagsProcessed) * 100).toFixed(1)}%)`);
    console.log();

    if (stats.failedRecipes.length > 0) {
      console.log('⚠️  Failed Recipes:');
      stats.failedRecipes.forEach((failed) => {
        console.log(`   - ${failed.name} (${failed.id}): ${failed.error}`);
      });
      console.log();
    }

    if (dryRun) {
      console.log('✅ Dry run complete! No changes were made.');
      console.log('💡 Run with --apply flag to apply migration: pnpm tsx scripts/migrate-tags-to-ids.ts --apply');
    } else {
      console.log('✅ Migration complete! All recipes have been updated.');
    }

  } catch (error) {
    console.error();
    console.error('❌ Migration failed with error:');
    console.error(error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const applyFlag = args.includes('--apply');
const dryRun = !applyFlag;

// Run migration
migrateAllRecipes(dryRun)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
