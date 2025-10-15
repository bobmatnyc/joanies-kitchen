import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

interface Recipe {
  id: string;
  name: string;
  source: string | null;
  systemRating: string | null;
  createdAt: Date | null;
}

async function deduplicateRecipes(dryRun: boolean = true) {
  console.log('🔍 Analyzing duplicate recipes...\n');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No recipes will be deleted\n');
  } else {
    console.log('🚨 LIVE MODE - Duplicates will be permanently deleted!\n');
  }

  // Get all recipes
  const allRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      source: recipes.source,
      systemRating: recipes.systemRating,
      createdAt: recipes.createdAt,
    })
    .from(recipes)
    .orderBy(asc(recipes.name));

  console.log(`📊 Total recipes: ${allRecipes.length}\n`);

  // Group by normalized name
  const nameGroups = new Map<string, Recipe[]>();

  for (const recipe of allRecipes) {
    const normalizedName = recipe.name.toLowerCase().trim();
    if (!nameGroups.has(normalizedName)) {
      nameGroups.set(normalizedName, []);
    }
    nameGroups.get(normalizedName)!.push(recipe);
  }

  // Find duplicates
  const duplicateGroups = Array.from(nameGroups.entries())
    .filter(([_, recipes]) => recipes.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!\n');
    process.exit(0);
  }

  console.log(`❌ Found ${duplicateGroups.length} duplicate recipe groups\n`);

  let totalToDelete = 0;
  const idsToDelete: string[] = [];

  for (const [normalizedName, dupes] of duplicateGroups) {
    console.log(`\n📝 "${dupes[0].name}" (${dupes.length} copies)`);

    // Sort to find best recipe to keep:
    // 1. Highest rating
    // 2. If ratings equal, oldest createdAt
    // 3. If both null, first one
    const sorted = [...dupes].sort((a, b) => {
      // Compare ratings (higher is better)
      const ratingA = a.systemRating ? parseFloat(a.systemRating) : 0;
      const ratingB = b.systemRating ? parseFloat(b.systemRating) : 0;

      if (ratingA !== ratingB) {
        return ratingB - ratingA; // Descending (highest first)
      }

      // If ratings equal, compare createdAt (older is better)
      if (a.createdAt && b.createdAt) {
        return a.createdAt.getTime() - b.createdAt.getTime(); // Ascending (oldest first)
      }

      // If one has createdAt and other doesn't, prefer the one with date
      if (a.createdAt) return -1;
      if (b.createdAt) return 1;

      // Otherwise, keep first one
      return 0;
    });

    const toKeep = sorted[0];
    const toDelete = sorted.slice(1);

    console.log(`   ✅ KEEP: ${toKeep.id.substring(0, 8)} | Rating: ${toKeep.systemRating || 'N/A'} | Created: ${toKeep.createdAt?.toISOString().split('T')[0] || 'N/A'}`);
    console.log(`   🗑️  DELETE ${toDelete.length} copies:`);

    for (const recipe of toDelete) {
      console.log(`      - ${recipe.id.substring(0, 8)} | Rating: ${recipe.systemRating || 'N/A'} | Created: ${recipe.createdAt?.toISOString().split('T')[0] || 'N/A'}`);
      idsToDelete.push(recipe.id);
    }

    totalToDelete += toDelete.length;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 DEDUPLICATION SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total recipes: ${allRecipes.length}`);
  console.log(`Duplicate groups: ${duplicateGroups.length}`);
  console.log(`Recipes to DELETE: ${totalToDelete}`);
  console.log(`Recipes to KEEP: ${allRecipes.length - totalToDelete}`);
  console.log(`Reduction: ${((totalToDelete / allRecipes.length) * 100).toFixed(1)}%`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (dryRun) {
    console.log('ℹ️  This was a DRY RUN - no recipes were deleted.');
    console.log('   To actually delete duplicates, run: pnpm run db:dedupe:execute\n');
  } else {
    console.log('🚨 Deleting duplicates...\n');

    let deleted = 0;
    const batchSize = 50;

    // Delete in batches
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);

      for (const id of batch) {
        await db.delete(recipes).where(eq(recipes.id, id));
        deleted++;
        if (deleted % 10 === 0) {
          console.log(`   Deleted ${deleted}/${idsToDelete.length} recipes...`);
        }
      }
    }

    console.log(`\n✅ Successfully deleted ${deleted} duplicate recipes!\n`);

    // Verify
    const remaining = await db.select({ id: recipes.id }).from(recipes);
    console.log(`📊 Recipes remaining: ${remaining.length}\n`);
  }

  process.exit(0);
}

// Check command line args
const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

deduplicateRecipes(dryRun).catch((error) => {
  console.error('Error during deduplication:', error);
  process.exit(1);
});
