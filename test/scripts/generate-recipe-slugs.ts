/**
 * Bulk Recipe Slug Generation Script
 *
 * Generates SEO-friendly slugs for all recipes in the database.
 * Processes recipes in batches with progress tracking and error handling.
 *
 * Features:
 * - Batch processing (100 recipes at a time)
 * - Duplicate detection and resolution
 * - Progress tracking with ETA
 * - Dry-run mode for validation
 * - Detailed logging
 * - Error recovery
 *
 * Usage:
 *   tsx scripts/generate-recipe-slugs.ts [options]
 *
 * Options:
 *   --dry-run    Show what would be done without making changes
 *   --batch=N    Process N recipes per batch (default: 100)
 *   --verbose    Show detailed progress for each recipe
 */

import { eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { generateUniqueSlug, validateSlug } from '@/lib/utils/slug';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const batchSizeArg = args.find((arg) => arg.startsWith('--batch='));
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 100;

// Statistics tracking
interface Stats {
  total: number;
  processed: number;
  success: number;
  skipped: number;
  errors: number;
  duplicatesResolved: number;
  startTime: number;
}

const stats: Stats = {
  total: 0,
  processed: 0,
  success: 0,
  skipped: 0,
  errors: 0,
  duplicatesResolved: 0,
  startTime: Date.now(),
};

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Calculate and format ETA
 */
function formatETA(stats: Stats): string {
  if (stats.processed === 0) return 'calculating...';

  const elapsed = Date.now() - stats.startTime;
  const avgTimePerRecipe = elapsed / stats.processed;
  const remaining = stats.total - stats.processed;
  const eta = remaining * avgTimePerRecipe;

  return formatDuration(eta);
}

/**
 * Display progress bar
 */
function displayProgress(stats: Stats) {
  const percentage = Math.floor((stats.processed / stats.total) * 100);
  const barWidth = 30;
  const filled = Math.floor((stats.processed / stats.total) * barWidth);
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const elapsed = formatDuration(Date.now() - stats.startTime);
  const eta = formatETA(stats);

  process.stdout.write(
    `\r[${bar}] ${percentage}% | ${stats.processed}/${stats.total} | ` +
      `✓ ${stats.success} | ✗ ${stats.errors} | ⊘ ${stats.skipped} | ` +
      `Elapsed: ${elapsed} | ETA: ${eta}`
  );
}

/**
 * Process a single recipe to generate slug
 */
async function processRecipe(
  recipe: any
): Promise<{ success: boolean; slug?: string; error?: string }> {
  try {
    // Skip if already has a slug (unless in dry-run with verbose mode)
    if (recipe.slug && !isDryRun) {
      if (isVerbose) {
        console.log(`  ⊘ Skipped: "${recipe.name}" (already has slug: ${recipe.slug})`);
      }
      return { success: true, slug: recipe.slug };
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(recipe.name, recipe.id);

    // Validate generated slug
    const validation = validateSlug(slug);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check if slug differs from any existing one (duplicate resolution)
    const isDuplicate = slug.match(/-\d+$/);
    if (isDuplicate) {
      stats.duplicatesResolved++;
    }

    if (isVerbose) {
      const status = isDryRun ? '[DRY RUN]' : '[UPDATING]';
      console.log(`  ${status} "${recipe.name}" -> "${slug}"`);
    }

    // Update database (unless dry-run)
    if (!isDryRun) {
      await db
        .update(recipes)
        .set({
          slug: slug,
          updated_at: new Date(),
        })
        .where(eq(recipes.id, recipe.id));
    }

    return { success: true, slug };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    if (isVerbose) {
      console.log(`  ✗ Error: "${recipe.name}" - ${errorMsg}`);
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Process a batch of recipes
 */
async function processBatch(batch: any[]): Promise<void> {
  const promises = batch.map((recipe) => processRecipe(recipe));
  const results = await Promise.all(promises);

  results.forEach((result) => {
    stats.processed++;
    if (result.success) {
      stats.success++;
    } else {
      stats.errors++;
    }
  });

  displayProgress(stats);
}

/**
 * Main execution function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log("║       Recipe Slug Generation - Joanie's Kitchen                ║");
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE: No changes will be made to the database\n');
  }

  try {
    // Step 1: Count total recipes without slugs
    console.log('Step 1: Counting recipes that need slugs...');
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(recipes)
      .where(isNull(recipes.slug));

    stats.total = countResult[0]?.count || 0;

    if (stats.total === 0) {
      console.log('✓ All recipes already have slugs!\n');
      console.log(
        'Total recipes in database:',
        (await db.select({ count: sql<number>`count(*)::int` }).from(recipes))[0]?.count || 0
      );
      return;
    }

    console.log(`✓ Found ${stats.total.toLocaleString()} recipes without slugs\n`);

    // Step 2: Fetch recipes in batches and process
    console.log(`Step 2: Processing recipes in batches of ${BATCH_SIZE}...\n`);

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch
      const batch = await db
        .select()
        .from(recipes)
        .where(isNull(recipes.slug))
        .limit(BATCH_SIZE)
        .offset(offset);

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      // Process batch
      await processBatch(batch);

      offset += BATCH_SIZE;

      // Add small delay between batches to avoid overwhelming database
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Final progress update
    console.log('\n');

    // Step 3: Display summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                       SUMMARY                                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const duration = formatDuration(Date.now() - stats.startTime);

    console.log(`Total Recipes:              ${stats.total.toLocaleString()}`);
    console.log(
      `Successfully Processed:     ${stats.success.toLocaleString()} (${Math.round((stats.success / stats.total) * 100)}%)`
    );
    console.log(`Errors:                     ${stats.errors.toLocaleString()}`);
    console.log(`Skipped (already had slug): ${stats.skipped.toLocaleString()}`);
    console.log(`Duplicates Resolved:        ${stats.duplicatesResolved.toLocaleString()}`);
    console.log(`Total Time:                 ${duration}`);
    console.log(
      `Average Time per Recipe:    ${Math.round((Date.now() - stats.startTime) / stats.total)}ms\n`
    );

    if (isDryRun) {
      console.log('🔍 DRY RUN COMPLETE: No changes were made to the database');
      console.log('   Run without --dry-run to apply these changes\n');
    } else {
      console.log('✅ SLUG GENERATION COMPLETE!\n');
      console.log('Next steps:');
      console.log('1. Verify slug generation: tsx scripts/test-recipe-slugs.ts');
      console.log('2. Update application code to use slug-based URLs');
      console.log('3. Deploy changes to production\n');
    }

    if (stats.errors > 0) {
      console.log('⚠️  Some recipes had errors. Review the output above for details.');
      console.log('   Run with --verbose flag to see detailed error messages.\n');
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
